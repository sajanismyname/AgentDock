import { AppDataSource } from '../config/data-source';
import { TestRun, TestRunResponseDto } from '../entities/TestRun';
import { TestResult } from '../entities/TestResult';
import { TestCase } from '../entities/TestCase';
import { AgentService } from './agent.service';
import { EvaluatorService } from './evaluator.service';
import { SafeHttpClient } from '../utils/safeHttpClient';
import { DistributedLockService } from './lock.service';
import { RunJobPayload, RunQueueService } from './queue.service';

export class WorkerService {
  private static isRunning = false;
  private static loopTimer: NodeJS.Timeout | null = null;

  private static getRunRepository() {
    return AppDataSource.getRepository(TestRun);
  }

  private static getResultRepository() {
    return AppDataSource.getRepository(TestResult);
  }

  /**
   * Processes a single test run job with comprehensive safety, deterministic evaluation,
   * failure handling, duplicate protection, and guaranteed lock release.
   */
  static async processJob(job: RunJobPayload): Promise<TestRunResponseDto | null> {
    const runRepository = this.getRunRepository();
    const resultRepository = this.getResultRepository();

    const testRun = await runRepository.findOne({
      where: { id: job.runId, userId: job.userId },
    });

    // Guard: ignore if test run not found or already in terminal state (duplicate job protection)
    if (!testRun) {
      // Clean up any stale lock
      await DistributedLockService.releaseUserRunLock(job.userId, job.runId);
      return null;
    }

    if (testRun.status === 'completed' || testRun.status === 'failed') {
      await DistributedLockService.releaseUserRunLock(job.userId, job.runId);
      return testRun.toJSON();
    }

    try {
      // Transition from pending to running
      testRun.status = 'running';
      testRun.startedAt = new Date();
      await runRepository.save(testRun);

      // Verify agent ownership
      const agent = await AgentService.getAgentById(job.userId, job.agentId);

      // Fetch test cases to execute
      const testCaseRepository = AppDataSource.getRepository(TestCase);
      const testQuery = testCaseRepository
        .createQueryBuilder('testCase')
        .leftJoinAndSelect('testCase.rule', 'rule')
        .where('testCase.agentId = :agentId', { agentId: job.agentId });

      if (job.suiteType === 'regression') {
        testQuery.andWhere('testCase.isRegression = true');
      }

      const testCases = await testQuery.take(25).getMany();

      if (testCases.length === 0) {
        testRun.status = 'failed';
        testRun.totalTests = 0;
        testRun.passedTests = 0;
        testRun.failedTests = 0;
        testRun.score = 0;
        testRun.completedAt = new Date();
        await runRepository.save(testRun);
        return testRun.toJSON();
      }

      testRun.totalTests = testCases.length;
      await runRepository.save(testRun);

      // Fetch decrypted credential if configured on agent
      const decryptedCredential = await AgentService.getDecryptedCredential(job.userId, job.agentId);
      const requestHeaders: Record<string, string> = {};
      if (decryptedCredential) {
        requestHeaders['Authorization'] = decryptedCredential.startsWith('Bearer ')
          ? decryptedCredential
          : `Bearer ${decryptedCredential}`;
      }

      let passedCount = 0;
      let failedCount = 0;

      // Sequentially execute test cases
      for (const testCase of testCases) {
        const payload = {
          message: testCase.prompt,
          prompt: testCase.prompt,
        };

        let responseBody: unknown;
        let toolCalls: Array<{ name: string; arguments?: unknown }> | null = null;
        let durationMs = 0;
        let httpStatus = 200;

        try {
          const res = await SafeHttpClient.post(agent.endpoint, payload, requestHeaders);
          responseBody = res.data;
          durationMs = res.durationMs;
          httpStatus = res.status;

          if (res.data && typeof res.data === 'object') {
            const dataObj = res.data as Record<string, unknown>;
            if (Array.isArray(dataObj.tool_calls)) {
              toolCalls = dataObj.tool_calls as Array<{ name: string; arguments?: unknown }>;
            } else if (Array.isArray(dataObj.toolCalls)) {
              toolCalls = dataObj.toolCalls as Array<{ name: string; arguments?: unknown }>;
            }
          }
        } catch (error) {
          responseBody = {
            error: (error as Error).message,
          };
          durationMs = 0;
          httpStatus = 500;
        }

        // Evaluate test output deterministically
        const evaluation = EvaluatorService.evaluate(
          testCase.rule,
          testCase,
          payload,
          responseBody,
          toolCalls,
          durationMs,
          httpStatus
        );

        if (evaluation.status === 'PASS') {
          passedCount++;
        } else {
          failedCount++;
        }

        // Persist TestResult
        const testResult = resultRepository.create({
          testRunId: testRun.id,
          testCaseId: testCase.id,
          status: evaluation.status,
          requestPayload: payload,
          responsePayload: responseBody,
          toolCalls,
          explanation: evaluation.explanation,
          technicalDetails: evaluation.technicalDetails,
        });

        await resultRepository.save(testResult);
      }

      // Finalize run
      const finalScore = Number(((passedCount / testCases.length) * 100).toFixed(2));
      testRun.status = 'completed';
      testRun.passedTests = passedCount;
      testRun.failedTests = failedCount;
      testRun.score = finalScore;
      testRun.completedAt = new Date();

      await runRepository.save(testRun);
      return testRun.toJSON();
    } catch (err) {
      // Unhandled worker error: mark run as failed so it never stays stuck in running
      testRun.status = 'failed';
      testRun.completedAt = new Date();
      try {
        await runRepository.save(testRun);
      } catch {
        // Ignore DB save failure in crash handler
      }
      return testRun.toJSON();
    } finally {
      // Guaranteed release of distributed user lock
      await DistributedLockService.releaseUserRunLock(job.userId, job.runId);
    }
  }

  /**
   * Starts the background worker polling loop.
   */
  static startWorkerLoop(pollIntervalMs: number = 300): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;

      try {
        const job = await RunQueueService.dequeueRunJob();
        if (job) {
          await this.processJob(job);
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') {
          // eslint-disable-next-line no-console
          console.error('[Worker] Job processing loop error:', err);
        }
      }

      if (this.isRunning) {
        this.loopTimer = setTimeout(poll, pollIntervalMs);
      }
    };

    this.loopTimer = setTimeout(poll, pollIntervalMs);
  }

  /**
   * Stops the background worker polling loop.
   */
  static stopWorkerLoop(): void {
    this.isRunning = false;
    if (this.loopTimer) {
      clearTimeout(this.loopTimer);
      this.loopTimer = null;
    }
  }

  /**
   * Checks if worker loop is currently active.
   */
  static isLoopRunning(): boolean {
    return this.isRunning;
  }
}
