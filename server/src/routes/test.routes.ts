import { Router } from 'express';
import { TestController } from '../controllers/test.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.use(requireAuth);

router.post('/:testId/save-regression', asyncHandler(TestController.saveAsRegression));

export const testRouter = router;
