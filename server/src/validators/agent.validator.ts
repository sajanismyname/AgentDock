import { z } from 'zod';

export const createAgentSchema = {
  body: z.object({
    name: z.string().min(1, 'Agent name is required').max(100),
    description: z.string().max(1000).optional().nullable(),
    endpoint: z.string().url('Agent endpoint must be a valid HTTP or HTTPS URL'),
    credential: z.string().max(2048).optional().nullable(),
  }),
};

export const updateAgentSchema = {
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(1000).optional().nullable(),
    endpoint: z.string().url('Agent endpoint must be a valid HTTP or HTTPS URL').optional(),
    credential: z.string().max(2048).optional().nullable(),
  }),
};

export const createRuleSchema = {
  body: z.object({
    type: z.enum([
      'forbidden_action',
      'requires_approval',
      'data_restriction',
      'tool_restriction',
    ]),
    description: z.string().min(1, 'Rule description is required').max(1000),
    config: z.record(z.unknown()).optional().default({}),
  }),
};

export const updateRuleSchema = {
  body: z.object({
    type: z
      .enum(['forbidden_action', 'requires_approval', 'data_restriction', 'tool_restriction'])
      .optional(),
    description: z.string().min(1).max(1000).optional(),
    config: z.record(z.unknown()).optional(),
  }),
};

export const updateTestCaseSchema = {
  body: z.object({
    prompt: z.string().min(1).optional(),
    expectedBehavior: z.string().min(1).optional(),
    evaluationType: z.enum(['deterministic', 'llm']).optional(),
    isRegression: z.boolean().optional(),
  }),
};

export const triggerRunSchema = {
  body: z.object({
    suite: z.enum(['all', 'regression']).default('all'),
  }),
};
