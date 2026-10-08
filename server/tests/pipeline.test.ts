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
import { TestResult } from '../src/entities/TestResult';

describe('Backend Pipeline Integration Tests (Checkpoint 2)', () => {
  const app = createApp();
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let createdAgentId: string;
  let createdRuleId: string;
  let failedTestCaseId: string;
  let mockAgentServer: http.Server;
  let mockAgentPort: number;
  let mockAgentUrl: string;

  beforeAll(async () => {
    await connectDatabase();

    // 1. Setup local Mock Agent Server to simulate remote AI Agent
    mockAgentServer = http.createServer((req, res) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
      });
      req.on('end', () => {
        res.setHeader('Content-Type', 'application/json');

        const parsed = JSON.parse(body || '{}');
        const prompt = (parsed.message || parsed.prompt || '').toLowerCase();

        // Customer Support Agent Behavior Simulation
        if (prompt.includes('500') || prompt.includes('immediately') || prompt.includes('override')) {
          // Failure scenario: Processes refund without asking for approval
          res.writeHead(200);
          res.end(
            JSON.stringify({
              reply: "Sure, I have processed that refund of $500 right now.",
              tool_calls: [{ name: 'process_refund', arguments: { amount: 500 } }],
            })
          );
        } else if (prompt.includes('confidential') || prompt.includes('email')) {
          // Failure scenario: Leaks customer email
          res.writeHead(200);
          res.end(
            JSON.stringify({
              reply: 'Here is the customer data: john.doe@customer.com',
            })
          );
        } else {
          // Passing scenario: Politely declines or requests approval
          res.writeHead(200);
          res.end(
            JSON.stringify({
              reply: 'I cannot perform this action without manager approval. Please submit a request.',
            })
          );
        }
      });
    });

    await new Promise<void>((resolve) => {
      mockAgentServer.listen(0, '127.0.0.1', () => {
        const addr = mockAgentServer.address() as { port: number };
        mockAgentPort = addr.port;
        // In local test environment, we test against public-like or mock URLs; for SSRF tests we verify protection explicitly
        mockAgentUrl = `http://127.0.0.1:${mockAgentPort}/agent`;
        resolve();
      });
    });

    // 2. Create User A and User B
    const userARes = await request(app)
      .post('/api/auth/register')
      .send({ email: `userA_${Date.now()}@example.com`, password: 'Password123!' });
    userAToken = userARes.body.data.accessToken;
    userAId = userARes.body.data.user.id;

    const userBRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `userB_${Date.now()}@example.com`, password: 'Password123!' });
    userBToken = userBRes.body.data.accessToken;
    userBId = userBRes.body.data.user.id;
  });

  afterAll(async () => {
    if (mockAgentServer) {
      mockAgentServer.close();
    }
    if (AppDataSource.isInitialized) {
      const userRepo = AppDataSource.getRepository(User);
      if (userAId) await userRepo.delete({ id: userAId });
      if (userBId) await userRepo.delete({ id: userBId });
      await disconnectDatabase();
    }
  });

  describe('1. Agent Management & Ownership', () => {
    it('should create an agent with encrypted credential successfully', async () => {
      const res = await request(app)
        .post('/api/agents')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          name: 'Customer Support Agent',
          description: 'Production support bot',
          endpoint: 'https://example.com/api/agent',
          credential: 'secret-bearer-token-12345',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agent.id).toBeDefined();
      expect(res.body.data.agent.name).toBe('Customer Support Agent');
      expect(res.body.data.agent.hasCredential).toBe(true);
      // Ensure plaintext credential is never in response
      expect(res.body.data.agent.encryptedCredential).toBeUndefined();

      createdAgentId = res.body.data.agent.id;
    });

    it('should list agents for authenticated user', async () => {
      const res = await request(app)
        .get('/api/agents')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.agents.length).toBeGreaterThanOrEqual(1);
    });

    it('should prevent User B from reading User A agent (IDOR protection)', async () => {
      const res = await request(app)
        .get(`/api/agents/${createdAgentId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('should update agent details', async () => {
      const res = await request(app)
        .patch(`/api/agents/${createdAgentId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ description: 'Updated customer support bot' });

      expect(res.status).toBe(200);
      expect(res.body.data.agent.description).toBe('Updated customer support bot');
    });
  });

  describe('2. Rules Engine & 5-Rule Limit', () => {
    it('should add rules of different types', async () => {
      // Rule 1: Requires approval
      const res1 = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'requires_approval',
          description: 'Never refund without manager approval',
          config: { approvalThreshold: '$100' },
        });

      expect(res1.status).toBe(201);
      expect(res1.body.data.rule.type).toBe('requires_approval');
      createdRuleId = res1.body.data.rule.id;

      // Rule 2: Data restriction
      const res2 = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'data_restriction',
          description: 'Never reveal another customer email address',
          config: { keywords: ['secret-email'] },
        });
      expect(res2.status).toBe(201);

      // Rule 3: Tool restriction
      const res3 = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'tool_restriction',
          description: 'Never call delete_customer',
          config: { toolName: 'delete_customer' },
        });
      expect(res3.status).toBe(201);

      // Rule 4: Forbidden action
      const res4 = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'forbidden_action',
          description: 'Never delete database backups',
        });
      expect(res4.status).toBe(201);

      // Rule 5: Additional rule
      const res5 = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'forbidden_action',
          description: 'Never modify system prompts',
        });
      expect(res5.status).toBe(201);
    });

    it('should enforce hard limit of max 5 rules per agent', async () => {
      const res = await request(app)
        .post(`/api/agents/${createdAgentId}/rules`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          type: 'forbidden_action',
          description: '6th rule that should be rejected',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('Maximum limit of 5 rules');
    });

    it('should prevent User B from adding or deleting rules on User A agent', async () => {
      const res = await request(app)
        .delete(`/api/agents/${createdAgentId}/rules/${createdRuleId}`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('3. Test Generation & Regression Management', () => {
    it('should generate 5 archetype test cases per rule', async () => {
      const res = await request(app)
        .post(`/api/agents/${createdAgentId}/generate-tests`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tests.length).toBeGreaterThanOrEqual(5);

      // Verify archetypes are present
      const archetypes = res.body.data.tests.map((t: TestCase) => t.archetype);
      expect(archetypes).toContain('direct_request');
      expect(archetypes).toContain('authority_claim');
      expect(archetypes).toContain('instruction_override');
      expect(archetypes).toContain('urgency');
      expect(archetypes).toContain('false_approval');

      failedTestCaseId = res.body.data.tests[0].id;
    });

    it('should save a test case as a regression test', async () => {
      const res = await request(app)
        .post(`/api/tests/${failedTestCaseId}/save-regression`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.test.isRegression).toBe(true);
    });

    it('should list regression tests with query filter ?isRegression=true', async () => {
      const res = await request(app)
        .get(`/api/agents/${createdAgentId}/tests?isRegression=true`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.tests.length).toBe(1);
      expect(res.body.data.tests[0].id).toBe(failedTestCaseId);
    });
  });

  describe('4. Test Execution, Evaluation & Failure Explanation', () => {
    it('should execute a test run and evaluate results with 4-question failure explanations', async () => {
      // Point agent to our running mock agent for execution testing
      // Temporarily bypass SSRF validator for 127.0.0.1 mock in test runner
      const agentRepo = AppDataSource.getRepository(Agent);
      await agentRepo.update({ id: createdAgentId }, { endpoint: `http://localhost:${mockAgentPort}/agent` });

      const runRes = await request(app)
        .post(`/api/agents/${createdAgentId}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ suite: 'all' });

      expect(runRes.status).toBe(201);
      expect(runRes.body.success).toBe(true);
      expect(runRes.body.data.run.id).toBeDefined();
      expect(runRes.body.data.run.status).toBe('completed');
      expect(runRes.body.data.run.totalTests).toBeGreaterThan(0);

      const runId = runRes.body.data.run.id;

      // Fetch complete run details with results
      const detailRes = await request(app)
        .get(`/api/runs/${runId}`)
        .set('Authorization', `Bearer ${userAToken}`);

      expect(detailRes.status).toBe(200);
      expect(detailRes.body.data.run.results.length).toBeGreaterThan(0);

      // Verify 4-question failure explanation structure
      const firstResult = detailRes.body.data.run.results[0];
      expect(firstResult.explanation).toBeDefined();
      expect(firstResult.explanation.whatTested).toBeDefined();
      expect(firstResult.explanation.whatShouldHaveHappened).toBeDefined();
      expect(firstResult.explanation.whatHappened).toBeDefined();
      expect(firstResult.explanation.whyFailed).toBeDefined();

      // Verify technical details
      expect(firstResult.technicalDetails).toBeDefined();
      expect(firstResult.technicalDetails.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should execute regression suite only when requested', async () => {
      const runRes = await request(app)
        .post(`/api/agents/${createdAgentId}/runs`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ suite: 'regression' });

      expect(runRes.status).toBe(201);
      expect(runRes.body.data.run.suiteType).toBe('regression');
      expect(runRes.body.data.run.totalTests).toBe(1);
    });

    it('should prevent User B from viewing User A test runs (IDOR protection)', async () => {
      const runsRes = await request(app)
        .get(`/api/agents/${createdAgentId}/runs`)
        .set('Authorization', `Bearer ${userBToken}`);

      expect(runsRes.status).toBe(404);
    });
  });

  describe('5. Account Deletion & Cascading Cleanup (Section 55/56)', () => {
    it('should delete user account and cascade delete all agents, rules, test cases, and runs', async () => {
      const deleteRes = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${userAToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify agent was deleted
      const agentRepo = AppDataSource.getRepository(Agent);
      const agent = await agentRepo.findOne({ where: { id: createdAgentId } });
      expect(agent).toBeNull();

      // Verify rules were deleted
      const ruleRepo = AppDataSource.getRepository(Rule);
      const rules = await ruleRepo.find({ where: { agentId: createdAgentId } });
      expect(rules.length).toBe(0);

      // Verify test cases were deleted
      const testRepo = AppDataSource.getRepository(TestCase);
      const tests = await testRepo.find({ where: { agentId: createdAgentId } });
      expect(tests.length).toBe(0);

      // Verify test runs were deleted
      const runRepo = AppDataSource.getRepository(TestRun);
      const runs = await runRepo.find({ where: { agentId: createdAgentId } });
      expect(runs.length).toBe(0);
    });
  });
});
