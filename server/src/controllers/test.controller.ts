import { Request, Response } from 'express';
import { TestService } from '../services/test.service';
import { UnauthorizedError } from '../errors/AppError';

export class TestController {
  static async generateTests(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const tests = await TestService.generateTests(req.user.id, req.params.agentId);
    res.status(201).json({
      success: true,
      data: { tests },
    });
  }

  static async listTests(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const isRegression =
      req.query.isRegression !== undefined
        ? req.query.isRegression === 'true'
        : undefined;

    const tests = await TestService.listTests(req.user.id, req.params.agentId, isRegression);
    res.status(200).json({
      success: true,
      data: { tests },
    });
  }

  static async updateTest(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const test = await TestService.updateTest(
      req.user.id,
      req.params.agentId,
      req.params.testId,
      req.body
    );
    res.status(200).json({
      success: true,
      data: { test },
    });
  }

  static async deleteTest(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    await TestService.deleteTest(req.user.id, req.params.agentId, req.params.testId);
    res.status(200).json({
      success: true,
      message: 'Test case deleted successfully',
    });
  }

  static async saveAsRegression(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const test = await TestService.saveAsRegression(req.user.id, req.params.testId);
    res.status(200).json({
      success: true,
      data: { test },
      message: 'Test case saved as regression test',
    });
  }
}
