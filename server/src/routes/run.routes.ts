import { Router } from 'express';
import { RunController } from '../controllers/run.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

router.get('/:runId', asyncHandler(RunController.getRunById));
router.get('/:runId/results/:resultId', asyncHandler(RunController.getResultById));

export const runRouter = router;
