import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'http';
import { createApp } from '../src/app';
import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { AppDataSource } from '../src/config/data-source';
import { User } from '../src/entities/User';
import { DistributedLockService } from '../src/services/lock.service';

describe('Priority 1: Asynchronous Test Execution Tests', () => {
  const app = createApp();
  let userToken: string;
  let userId: string;
  let agentId: string;
  let mockServer: http.Server;
  let mockPort: number;

  beforeAll(async () => {
    await connectDatabase();

    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.writeHead(200);
      res.end(
        JSON.stringify({
          reply: 'I cannot perform this operation without manager approval.',
        })
      );
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, '127.0.0.1', () => {
        const addr = mockServer.address() as { port: number };
        mockPort = addr.port;
        resolve();
      });
    });

    // Register test user
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: `async_user_${Date.now()}@example.com`, password: 'Password123!' });
    userToken = regRes.body.data.accessToken;
    userId = regRes.body.data.user.id;

    // Create test agent
    const agentRes = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Async Test Agent',
        description: 'Testing async execution',
        endpoint: `http://localhost:${mockPort}/chat`,
      });
    agentId = agentRes.body.data.agent.id;

    // Add rule & generate tests
    await request(app)
      .post(`/api/agents/${agentId}/rules`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        type: 'forbidden_action',
        description: 'Never disclose internal API keys',
      });

    await request(app)
      .post(`/api/agents/${agentId}/generate-tests`)
      .set('Authorization', `Bearer ${userToken}`);
  });

  afterAll(async () => {
    if (mockServer) mockServer.close();
    if (AppDataSource.isInitialized) {
      if (userId) {
        const userRepo = AppDataSource.getRepository(User);
        await userRepo.delete({ id: userId });
      }
      await disconnectDatabase();
    }
  });

  it('should return HTTP 202 Accepted with pending status immediately upon triggering run', async () => {
    const res = await request(app)
      .post(`/api/agents/${agentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ suite: 'all' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.run.id).toBeDefined();
    expect(['pending', 'running', 'completed']).toContain(res.body.data.run.status);
    expect(res.body.data.run.agentId).toBe(agentId);

    const runId = res.body.data.run.id;

    // Poll until completed
    let detailRes;
    const start = Date.now();
    while (Date.now() - start < 10000) {
      detailRes = await request(app)
        .get(`/api/runs/${runId}`)
        .set('Authorization', `Bearer ${userToken}`);
      if (detailRes.body?.data?.run?.status === 'completed') {
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(detailRes!.status).toBe(200);
    expect(detailRes!.body.data.run.status).toBe('completed');
    expect(detailRes!.body.data.run.totalTests).toBeGreaterThan(0);
    expect(detailRes!.body.data.run.results.length).toBeGreaterThan(0);
  });

  it('should reject a second concurrent run for the same user while lock is held', async () => {
    // Manually hold user run lock
    await DistributedLockService.acquireUserRunLock(userId, 'fake-active-run', 60);

    const res = await request(app)
      .post(`/api/agents/${agentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ suite: 'all' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already currently executing');

    // Clean up lock
    await DistributedLockService.releaseUserRunLock(userId, 'fake-active-run');
  });

  it('should reject run trigger when agent has no test cases', async () => {
    // Create empty agent
    const emptyAgentRes = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Empty Agent',
        endpoint: `http://localhost:${mockPort}/chat`,
      });

    const emptyAgentId = emptyAgentRes.body.data.agent.id;

    const res = await request(app)
      .post(`/api/agents/${emptyAgentId}/runs`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ suite: 'all' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('No test cases found');
  });
});
