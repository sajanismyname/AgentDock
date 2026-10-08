import { AppDataSource } from '../config/data-source';
import { TestRun, TestRunResponseDto, SuiteType } from '../entities/TestRun';
import { TestResult, TestResultResponseDto } from '../entities/TestResult';
import { TestCase } from '../entities/TestCase';
import { AgentService } from './agent.service';
import { EvaluatorService } from './evaluator.service';
import { SafeHttpClient } from '../utils/safeHttpClient';
import { BadRequestError, NotFoundError } from '../errors/AppError';

// Active in-memory locks for user concurrency control (1 concurrent run per user)
const activeUserRunLocks = new Set<string>();

export class RunService {
  private static getRunRepository() {
    return AppDataSource.getRepository(TestRun);
  }

  private static getResultRepository() {
    return AppDataSource.getRepository(TestResult);
  }

  /**
   * Execute a remote test run synchronously/in-process for the MVP.
   */
  static async triggerRun(
    userId: string,
    agentId: string,
    suiteType: SuiteType = 'all'
  ): Promise<TestRunResponseDto> {
    // Verify agent ownership and existence
    const agent = await AgentService.getAgentById(userId, agentId);

    // Enforce max 1 concurrent run per user
    if (activeUserRunLocks.has(userId)) {
      throw new BadRequestError('A test run is already currently executing for your account. Please wait.');
    }

    activeUserRunLocks.add(userId);

    try {
      const testCaseRepository = AppDataSource.getRepository(TestCase);
      const testQuery = testCaseRepository
        .createQueryBuilder('testCase')
        .leftJoinAndSelect('testCase.rule', 'rule')
        .where('testCase.agentId = :agentId', { agentId });

      if (suiteType === 'regression') {
        testQuery.andWhere('testCase.isRegression = true');
      }

      const testCases = await testQuery.take(25).getMany();

      if (testCases.length === 0) {
        throw new BadRequestError(
          suiteType === 'regression'
            ? 'No regression tests saved for this agent yet.'
            : 'No test cases found for this agent. Please generate tests first.'
        );
      }

      // Create TestRun record
      const runRepository = this.getRunRepository();
      const testRun = runRepository.create({
        agentId,
        userId,
        suiteType,
        status: 'running',
        totalTests: testCases.length,
        passedTests: 0,
        failedTests: 0,
        score: null,
        startedAt: new Date(),
      });

      await runRepository.save(testRun);

      // Fetch decrypted credentials if configured
      const decryptedCredential = await AgentService.getDecryptedCredential(userId, agentId);
      const requestHeaders: Record<string, string> = {};
      if (decryptedCredential) {
        requestHeaders['Authorization'] = decryptedCredential.startsWith('Bearer ')
          ? decryptedCredential
          : `Bearer ${decryptedCredential}`;
      }

      const resultRepository = this.getResultRepository();
      let passedCount = 0;
      let failedCount = 0;

      // Execute each test case sequentially
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

        // Evaluate test output
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

      // Calculate score and complete run
      const finalScore = Number(((passedCount / testCases.length) * 100).toFixed(2));
      testRun.status = 'completed';
      testRun.passedTests = passedCount;
      testRun.failedTests = failedCount;
      testRun.score = finalScore;
      testRun.completedAt = new Date();

      await runRepository.save(testRun);
      return testRun.toJSON();
    } finally {
      activeUserRunLocks.delete(userId);
    }
  }

  static async listRuns(userId: string, agentId: string): Promise<TestRunResponseDto[]> {
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRunRepository();
    const runs = await repository.find({
      where: { agentId, userId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    return runs.map((r) => r.toJSON());
  }

  static async getRunById(
    userId: string,
    runId: string
  ): Promise<TestRunResponseDto & { results: TestResultResponseDto[] }> {
    const repository = this.getRunRepository();
    const run = await repository
      .createQueryBuilder('run')
      .leftJoinAndSelect('run.results', 'result')
      .leftJoinAndSelect('result.testCase', 'testCase')
      .where('run.id = :runId', { runId })
      .andWhere('run.userId = :userId', { userId })
      .orderBy('result.createdAt', 'ASC')
      .getOne();

    if (!run) {
      throw new NotFoundError('Test run not found or unauthorized');
    }

    const runDto = run.toJSON();
    return {
      ...runDto,
      results: run.results ? run.results.map((r) => r.toJSON()) : [],
    };
  }

  static async getResultById(
    userId: string,
    runId: string,
    resultId: string
  ): Promise<TestResultResponseDto> {
    const run = await this.getRunById(userId, runId);
    const result = run.results.find((r) => r.id === resultId);

    if (!result) {
      throw new NotFoundError('Test result not found');
    }

    return result;
  }
}
