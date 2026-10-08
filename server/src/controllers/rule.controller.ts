import { Request, Response } from 'express';
import { RuleService } from '../services/rule.service';
import { UnauthorizedError } from '../errors/AppError';

export class RuleController {
  static async createRule(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const rule = await RuleService.createRule(req.user.id, req.params.agentId, req.body);
    res.status(201).json({
      success: true,
      data: { rule },
    });
  }

  static async listRules(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const rules = await RuleService.listRules(req.user.id, req.params.agentId);
    res.status(200).json({
      success: true,
      data: { rules },
    });
  }

  static async getRuleById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const rule = await RuleService.getRuleById(
      req.user.id,
      req.params.agentId,
      req.params.ruleId
    );
    res.status(200).json({
      success: true,
      data: { rule },
    });
  }

  static async updateRule(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const rule = await RuleService.updateRule(
      req.user.id,
      req.params.agentId,
      req.params.ruleId,
      req.body
    );
    res.status(200).json({
      success: true,
      data: { rule },
    });
  }

  static async deleteRule(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    await RuleService.deleteRule(req.user.id, req.params.agentId, req.params.ruleId);
    res.status(200).json({
      success: true,
      message: 'Rule deleted successfully',
    });
  }
}
