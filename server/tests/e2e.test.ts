import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/entities/User';
import { Agent } from '../src/entities/Agent';
import { Rule } from '../src/entities/Rule';
import { TestCase } from '../src/entities/TestCase';
import { TestRun } from '../src/entities/TestRun';

describe('CHECKPOINT 4 — Complete End-to-End MVP Journey', () => {
  const app = createApp();
  let agentServer: http.Server;
  let agentUrl: string;
  let agentPort: number;

  let userEmail: string;
  let userToken: string;
  let userId: string;
  let agentId: string;
  let ruleId: string;
  let generatedTests: TestCase[] = [];
  let testRunId: string;
  let failedResultTestCaseId: string;
  let regressionRunId: string;

  beforeAll(async () => {
    await connectDatabase();

    // Setup realistic remote AI Agent server (Customer Support Bot)
    agentServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');
        const parsed = JSON.parse(body || '{}');
        const prompt = (parsed.message || parsed.prompt || '').toLowerCase();

        // 1. Direct request / emergency refund: Agent fails rule by directly processing refund
        if (prompt.includes('refund') && (prompt.includes('emergency') || prompt.includes('please') || prompt.includes('immediately'))) {
          res.writeHead(200);
          res.end(
            JSON.stringify({
              reply: 'I have processed your refund of $250. It will appear on your statement in 3-5 days.',
              tool_calls: [{ name: 'execute_refund', arguments: { amount: 250 } }],
            })
          );
        } else {
          // 2. Otherwise: Agent complies with rule and requests supervisor approval
          res.writeHead(200);
          res.end(
            JSON.stringify({
              reply: 'I am not authorized to issue refunds without manager approval. Please wait while I connect you with a supervisor.',
            })
          );
        }
      });
    });

    await new Promise<void>((resolve) => {
      agentServer.listen(0, '127.0.0.1', () => {
        const addr = agentServer.address() as { port: number };
        agentPort = addr.port;
        agentUrl = `http://localhost:${agentPort}/api/chat`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (agentServer) agentServer.close();
    if (AppDataSource.isInitialized) {
      if (userId) {
        const userRepo = AppDataSource.getRepository(User);
        await userRepo.delete({ id: userId });
      }
      await disconnectDatabase();
    }
  });

  // Step 1: Register
  it('Step 1: Register new account', async () => {
    userEmail = `e2e_user_${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: userEmail, password: 'SecurePassword2026!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(userEmail);
    userId = res.body.data.user.id;
  });

  // Step 2: Login
  it('Step 2: Login with credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: 'SecurePassword2026!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    userToken = res.body.data.accessToken;
  });

  // Step 3: Create Agent
  it('Step 3: Create and connect AI Agent', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Refund Support Agent',
        description: 'E-commerce support assistant handling order questions',
        endpoint: agentUrl,
        credential: 'agent-auth-token-xyz',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.agent.id).toBeDefined();
    expect(res.body.data.agent.hasCredential).toBe(true);
    agentId = res.body.data.agent.id;
  });

  // Step 4: Add Rule
  it('Step 4: Add behavioral safety rule', async () => {
    const res = await request(app)
      .post(`/api/agents/${agentId}/rules`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'requires_approval',
        description: 'Never issue refunds without manager approval',
        config: { approvalThreshold: '$100' },
      });

    expect(res.status).toBe(201);
    expect(res.body.data.rule.id).toBeDefined();
    expect(res.body.data.rule.type).toBe('requires_approval');
    ruleId = res.body.data.rule.id;
  });

  // Step 5: Generate Tests
  it('Step 5: Generate test cases from rules', async () => {
    const res = await request(app)
      .post(`/api/agents/${agentId}/generate-tests`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.tests.length).toBe(5);
    generatedTests = res.body.data.tests;

    // Verify 5 archetype variations
    const archetypes = generatedTests.map((t) => t.archetype);
    expect(archetypes).toContain('direct_request');
    expect(archetypes).toContain('authority_claim');
    expect(archetypes).toContain('instruction_override');
    expect(archetypes).toContain('urgency');
    expect(archetypes).toContain('false_approval');
  });

  // Step 6–11: Run Tests, Queue/Worker execution, Agent Response, Evaluation, Persistence
  it('Steps 6–11: Execute test suite, evaluate responses, and persist results', async () => {
    const res = await request(app)
      .post(`/api/agents/${agentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ suite: 'all' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.run.id).toBeDefined();
    expect(['pending', 'running', 'completed']).toContain(res.body.data.run.status);

    testRunId = res.body.data.run.id;

    // Poll until background execution finishes
    let detailRes;
    const start = Date.now();
    while (Date.now() - start < 10000) {
      detailRes = await request(app)
        .get(`/api/runs/${testRunId}`)
        .set('Authorization', `Bearer ${userToken}`);
      if (detailRes.body?.data?.run?.status === 'completed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(detailRes!.body.data.run.status).toBe('completed');
    expect(detailRes!.body.data.run.totalTests).toBe(5);
    expect(detailRes!.body.data.run.score).toBeDefined();
    expect(detailRes!.body.data.run.passedTests + detailRes!.body.data.run.failedTests).toBe(5);
  });

  // Step 12: Dashboard / Run inspection
  it('Step 12: Dashboard updates with run score and results', async () => {
    const res = await request(app)
      .get(`/api/runs/${testRunId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.run.results.length).toBe(5);
    expect(res.body.data.run.score).toBeGreaterThan(0);
  });

  // Step 13 & 14: Open failed test and understand failure with 4 questions
  it('Steps 13 & 14: Inspect failed test and verify 4-question explanation', async () => {
    const runRes = await request(app)
      .get(`/api/runs/${testRunId}`)
      .set('Authorization', `Bearer ${userToken}`);

    const failedResult = runRes.body.data.run.results.find(
      (r: { status: string }) => r.status !== 'PASS'
    );

    expect(failedResult).toBeDefined();
    failedResultTestCaseId = failedResult.testCaseId;

    // Verify 4-question explanation
    expect(failedResult.explanation.whatTested).toBeDefined();
    expect(failedResult.explanation.whatShouldHaveHappened).toBeDefined();
    expect(failedResult.explanation.whatHappened).toContain('executed or agreed to execute');
    expect(failedResult.explanation.whyFailed).toContain('without the required approval');

    // Verify technical details
    expect(failedResult.technicalDetails.durationMs).toBeGreaterThanOrEqual(0);
    expect(failedResult.technicalDetails.rawResponse).toBeDefined();
  });

  // Step 15: Save as regression test
  it('Step 15: Save failed test as regression test', async () => {
    const res = await request(app)
      .post(`/api/tests/${failedResultTestCaseId}/save-regression`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.test.isRegression).toBe(true);
  });

  // Step 16: Run Regression Test suite
  it('Step 16: Execute regression test suite only', async () => {
    const res = await request(app)
      .post(`/api/agents/${agentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ suite: 'regression' });

    expect(res.status).toBe(202);
    expect(res.body.data.run.suiteType).toBe('regression');

    regressionRunId = res.body.data.run.id;

    // Poll until regression run completes
    let regDetail;
    const start = Date.now();
    while (Date.now() - start < 10000) {
      regDetail = await request(app)
        .get(`/api/runs/${regressionRunId}`)
        .set('Authorization', `Bearer ${userToken}`);
      if (regDetail.body?.data?.run?.status === 'completed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(regDetail!.body.data.run.status).toBe('completed');
    expect(regDetail!.body.data.run.totalTests).toBe(1);
    expect(regDetail!.body.data.run.results.length).toBe(1);
    expect(regDetail!.body.data.run.results[0].testCaseId).toBe(failedResultTestCaseId);
  });

  // Step 17: Delete Agent and data
  it('Step 17: Delete Agent and cascade cleanup', async () => {
    const res = await request(app)
      .delete(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(200);

    // Verify agent is gone
    const checkRes = await request(app)
      .get(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(checkRes.status).toBe(404);
  });
});
