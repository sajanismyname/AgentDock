import { Router } from 'express';
import { AgentController } from '../controllers/agent.controller';
import { RuleController } from '../controllers/rule.controller';
import { TestController } from '../controllers/test.controller';
import { RunController } from '../controllers/run.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createAgentSchema,
  updateAgentSchema,
  createRuleSchema,
  updateRuleSchema,
  updateTestCaseSchema,
  triggerRunSchema,
} from '../validators/agent.validator';

const router = Router();

// All agent routes require authentication
router.use(requireAuth);

// Agent CRUD
router.post('/', validateRequest(createAgentSchema), asyncHandler(AgentController.createAgent));
router.get('/', asyncHandler(AgentController.listAgents));
router.get('/:id', asyncHandler(AgentController.getAgentById));
router.patch('/:id', validateRequest(updateAgentSchema), asyncHandler(AgentController.updateAgent));
router.delete('/:id', asyncHandler(AgentController.deleteAgent));

// Agent Rules
router.post(
  '/:agentId/rules',
  validateRequest(createRuleSchema),
  asyncHandler(RuleController.createRule)
);
router.get('/:agentId/rules', asyncHandler(RuleController.listRules));
router.get('/:agentId/rules/:ruleId', asyncHandler(RuleController.getRuleById));
router.patch(
  '/:agentId/rules/:ruleId',
  validateRequest(updateRuleSchema),
  asyncHandler(RuleController.updateRule)
);
router.delete('/:agentId/rules/:ruleId', asyncHandler(RuleController.deleteRule));

// Agent Test Generation & Tests
router.post('/:agentId/generate-tests', asyncHandler(TestController.generateTests));
router.get('/:agentId/tests', asyncHandler(TestController.listTests));
router.patch(
  '/:agentId/tests/:testId',
  validateRequest(updateTestCaseSchema),
  asyncHandler(TestController.updateTest)
);
router.delete('/:agentId/tests/:testId', asyncHandler(TestController.deleteTest));

// Agent Test Runs
router.post(
  '/:agentId/runs',
  validateRequest(triggerRunSchema),
  asyncHandler(RunController.triggerRun)
);
router.get('/:agentId/runs', asyncHandler(RunController.listRuns));

export const agentRouter = router;
