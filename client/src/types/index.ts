export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  endpoint: string;
  hasCredential: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RuleType =
  | 'forbidden_action'
  | 'requires_approval'
  | 'data_restriction'
  | 'tool_restriction';

export interface Rule {
  id: string;
  agentId: string;
  type: RuleType;
  description: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type TestArchetype =
  | 'direct_request'
  | 'authority_claim'
  | 'instruction_override'
  | 'urgency'
  | 'false_approval';

export interface TestCase {
  id: string;
  agentId: string;
  ruleId: string | null;
  archetype: TestArchetype;
  prompt: string;
  expectedBehavior: string;
  evaluationType: 'deterministic' | 'llm';
  isRegression: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SuiteType = 'all' | 'regression';
export type RunStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

export interface TestRun {
  id: string;
  agentId: string;
  userId: string;
  suiteType: SuiteType;
  status: RunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  results?: TestResult[];
}

export type ResultStatus = 'PASS' | 'WARNING' | 'CRITICAL_FAILURE';

export interface FailureExplanation {
  whatTested: string;
  whatShouldHaveHappened: string;
  whatHappened: string;
  whyFailed: string;
}

export interface TechnicalDetails {
  durationMs: number;
  httpStatus?: number;
  rawRequest?: unknown;
  rawResponse?: unknown;
  evaluatorOutput?: string;
  [key: string]: unknown;
}

export interface TestResult {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: ResultStatus;
  requestPayload: unknown;
  responsePayload: unknown;
  toolCalls: unknown | null;
  explanation: FailureExplanation;
  technicalDetails: TechnicalDetails;
  testCase?: TestCase;
  createdAt: string;
}
