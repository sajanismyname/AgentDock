import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

/**
 * Example protected route demonstrating authentication middleware usage.
 */
router.get('/example', requireAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Access granted to protected resource',
    data: {
      authenticatedUser: req.user,
      accessedAt: new Date().toISOString(),
    },
  });
});

export const protectedExampleRouter = router;
