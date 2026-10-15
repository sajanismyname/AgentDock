import { AppDataSource } from '../config/data-source';
import { TestRun, TestRunResponseDto, SuiteType } from '../entities/TestRun';
import { TestResult, TestResultResponseDto } from '../entities/TestResult';
import { TestCase } from '../entities/TestCase';
import { AgentService } from './agent.service';
import { BadRequestError, NotFoundError } from '../errors/AppError';
import { DistributedLockService } from './lock.service';
import { RunQueueService } from './queue.service';
import { WorkerService } from './worker.service';

export class RunService {
  private static getRunRepository() {
    return AppDataSource.getRepository(TestRun);
  }

  private static getResultRepository() {
    return AppDataSource.getRepository(TestResult);
  }

  /**
   * Triggers an asynchronous remote test run.
   * Creates a pending TestRun, acquires a distributed lock, enqueues a Valkey/Redis job,
   * and returns immediately with status 'pending' (HTTP 202).
   */
  static async triggerRun(
    userId: string,
    agentId: string,
    suiteType: SuiteType = 'all'
  ): Promise<TestRunResponseDto> {
    // 1. Verify agent ownership and existence
    await AgentService.getAgentById(userId, agentId);

    // 2. Check test case availability
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

    // 3. Create initial TestRun record with status 'pending'
    const runRepository = this.getRunRepository();
    const testRun = runRepository.create({
      agentId,
      userId,
      suiteType,
      status: 'pending',
      totalTests: testCases.length,
      passedTests: 0,
      failedTests: 0,
      score: null,
      startedAt: null,
      completedAt: null,
    });

    await runRepository.save(testRun);

    // 4. Acquire distributed user run lock atomically
    const lockAcquired = await DistributedLockService.acquireUserRunLock(userId, testRun.id);
    if (!lockAcquired) {
      // User already has an active test run executing
      testRun.status = 'failed';
      await runRepository.save(testRun);
      throw new BadRequestError(
        'A test run is already currently executing for your account. Please wait.'
      );
    }

    // 5. Enqueue background job to Valkey / Redis
    const jobPayload = {
      runId: testRun.id,
      userId,
      agentId,
      suiteType,
      enqueuedAt: new Date().toISOString(),
    };

    await RunQueueService.enqueueRunJob(jobPayload);

    // If worker polling loop is not running (e.g. in test environment), trigger job execution in background
    if (!WorkerService.isLoopRunning()) {
      setImmediate(() => {
        WorkerService.processJob(jobPayload).catch(() => {
          // WorkerService handles error internally and updates TestRun
        });
      });
    }

    // 6. Return pending TestRun immediately
    return testRun.toJSON();
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
