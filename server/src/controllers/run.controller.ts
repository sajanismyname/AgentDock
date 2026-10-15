import { Request, Response } from 'express';
import { RunService } from '../services/run.service';
import { SuiteType } from '../entities/TestRun';
import { UnauthorizedError } from '../errors/AppError';

export class RunController {
  static async triggerRun(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const suiteType = (req.body?.suite || 'all') as SuiteType;
    const run = await RunService.triggerRun(req.user.id, req.params.agentId, suiteType);
    res.status(202).json({
      success: true,
      data: { run },
    });
  }

  static async listRuns(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const runs = await RunService.listRuns(req.user.id, req.params.agentId);
    res.status(200).json({
      success: true,
      data: { runs },
    });
  }

  static async getRunById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const run = await RunService.getRunById(req.user.id, req.params.runId);
    res.status(200).json({
      success: true,
      data: { run },
    });
  }

  static async getResultById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const result = await RunService.getResultById(
      req.user.id,
      req.params.runId,
      req.params.resultId
    );
    res.status(200).json({
      success: true,
      data: { result },
    });
  }
}
