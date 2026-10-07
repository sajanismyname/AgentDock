import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validate';
import { authRateLimiterMiddleware } from '../middleware/security';
import { requireAuth } from '../middleware/auth.middleware';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

router.post(
  '/register',
  authRateLimiterMiddleware,
  validateRequest(registerSchema),
  asyncHandler(AuthController.register)
);

router.post(
  '/login',
  authRateLimiterMiddleware,
  validateRequest(loginSchema),
  asyncHandler(AuthController.login)
);

router.post('/refresh', asyncHandler(AuthController.refresh));

router.post('/logout', asyncHandler(AuthController.logout));

router.post(
  '/forgot-password',
  authRateLimiterMiddleware,
  validateRequest(forgotPasswordSchema),
  asyncHandler(AuthController.forgotPassword)
);

router.post(
  '/reset-password',
  authRateLimiterMiddleware,
  validateRequest(resetPasswordSchema),
  asyncHandler(AuthController.resetPassword)
);

// Protected user profile route
router.get('/me', requireAuth, asyncHandler(AuthController.getMe));

export const authRouter = router;
