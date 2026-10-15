import {
  User,
  Agent,
  Rule,
  RuleType,
  TestCase,
  TestRun,
  TestResult,
  SuiteType,
} from '../types';

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (inMemoryAccessToken) {
    headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Sends HTTP-only refresh cookies
  });

  const body: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: {
      code: 'PARSE_ERROR',
      message: 'Failed to parse server response',
    },
  }));

  if (!response.ok || !body.success) {
    const errorMsg = body.error?.message || response.statusText || 'Request failed';
    const err = new Error(errorMsg) as Error & { code?: string; details?: unknown; status?: number };
    err.code = body.error?.code;
    err.details = body.error?.details;
    err.status = response.status;
    throw err;
  }

  return (body.data !== undefined ? body.data : body) as T;
}

export const api = {
  // Auth
  auth: {
    async register(email: string, password: string): Promise<{ user: User; accessToken: string }> {
      const res = await request<{ user: User; accessToken: string }>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.accessToken);
      return res;
    },

    async login(email: string, password: string): Promise<{ user: User; accessToken: string }> {
      const res = await request<{ user: User; accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setAccessToken(res.accessToken);
      return res;
    },

    async refresh(): Promise<{ accessToken: string }> {
      const res = await request<{ accessToken: string }>('/api/auth/refresh', {
        method: 'POST',
      });
      setAccessToken(res.accessToken);
      return res;
    },

    async logout(): Promise<void> {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        setAccessToken(null);
      }
    },

    async getMe(): Promise<{ user: User }> {
      return request<{ user: User }>('/api/auth/me');
    },

    async deleteAccount(): Promise<void> {
      await request('/api/auth/account', { method: 'DELETE' });
      setAccessToken(null);
    },
  },

  // Agents
  agents: {
    async list(): Promise<{ agents: Agent[] }> {
      return request<{ agents: Agent[] }>('/api/agents');
    },

    async create(data: {
      name: string;
      description?: string | null;
      endpoint: string;
      credential?: string | null;
    }): Promise<{ agent: Agent }> {
      return request<{ agent: Agent }>('/api/agents', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async getById(id: string): Promise<{ agent: Agent }> {
      return request<{ agent: Agent }>(`/api/agents/${id}`);
    },

    async update(
      id: string,
      data: { name?: string; description?: string | null; endpoint?: string; credential?: string | null }
    ): Promise<{ agent: Agent }> {
      return request<{ agent: Agent }>(`/api/agents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(id: string): Promise<void> {
      return request<void>(`/api/agents/${id}`, { method: 'DELETE' });
    },
  },

  // Rules
  rules: {
    async list(agentId: string): Promise<{ rules: Rule[] }> {
      return request<{ rules: Rule[] }>(`/api/agents/${agentId}/rules`);
    },

    async create(
      agentId: string,
      data: { type: RuleType; description: string; config?: Record<string, unknown> }
    ): Promise<{ rule: Rule }> {
      return request<{ rule: Rule }>(`/api/agents/${agentId}/rules`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    async update(
      agentId: string,
      ruleId: string,
      data: { type?: RuleType; description?: string; config?: Record<string, unknown> }
    ): Promise<{ rule: Rule }> {
      return request<{ rule: Rule }>(`/api/agents/${agentId}/rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(agentId: string, ruleId: string): Promise<void> {
      return request<void>(`/api/agents/${agentId}/rules/${ruleId}`, { method: 'DELETE' });
    },
  },

  // Tests
  tests: {
    async generate(agentId: string): Promise<{ tests: TestCase[] }> {
      return request<{ tests: TestCase[] }>(`/api/agents/${agentId}/generate-tests`, {
        method: 'POST',
      });
    },

    async list(agentId: string, isRegression?: boolean): Promise<{ tests: TestCase[] }> {
      const url =
        isRegression !== undefined
          ? `/api/agents/${agentId}/tests?isRegression=${isRegression}`
          : `/api/agents/${agentId}/tests`;
      return request<{ tests: TestCase[] }>(url);
    },

    async update(
      agentId: string,
      testId: string,
      data: { prompt?: string; expectedBehavior?: string; isRegression?: boolean }
    ): Promise<{ test: TestCase }> {
      return request<{ test: TestCase }>(`/api/agents/${agentId}/tests/${testId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    async delete(agentId: string, testId: string): Promise<void> {
      return request<void>(`/api/agents/${agentId}/tests/${testId}`, { method: 'DELETE' });
    },

    async saveAsRegression(testId: string): Promise<{ test: TestCase }> {
      return request<{ test: TestCase }>(`/api/tests/${testId}/save-regression`, {
        method: 'POST',
      });
    },
  },

  // Runs
  runs: {
    async trigger(agentId: string, suite: SuiteType = 'all'): Promise<{ run: TestRun }> {
      return request<{ run: TestRun }>(`/api/agents/${agentId}/runs`, {
        method: 'POST',
        body: JSON.stringify({ suite }),
      });
    },

    async list(agentId: string): Promise<{ runs: TestRun[] }> {
      return request<{ runs: TestRun[] }>(`/api/agents/${agentId}/runs`);
    },

    async getById(runId: string): Promise<{ run: TestRun & { results: TestResult[] } }> {
      return request<{ run: TestRun & { results: TestResult[] } }>(`/api/runs/${runId}`);
    },

    async getResult(runId: string, resultId: string): Promise<{ result: TestResult }> {
      return request<{ result: TestResult }>(`/api/runs/${runId}/results/${resultId}`);
    },
  },
};
