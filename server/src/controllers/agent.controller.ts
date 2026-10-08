import { Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
import { UnauthorizedError } from '../errors/AppError';

export class AgentController {
  static async createAgent(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const agent = await AgentService.createAgent(req.user.id, req.body);
    res.status(201).json({
      success: true,
      data: { agent },
    });
  }

  static async listAgents(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const agents = await AgentService.listAgents(req.user.id);
    res.status(200).json({
      success: true,
      data: { agents },
    });
  }

  static async getAgentById(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const agent = await AgentService.getAgentById(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      data: { agent },
    });
  }

  static async updateAgent(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    const agent = await AgentService.updateAgent(req.user.id, req.params.id, req.body);
    res.status(200).json({
      success: true,
      data: { agent },
    });
  }

  static async deleteAgent(req: Request, res: Response): Promise<void> {
    if (!req.user) throw new UnauthorizedError('Unauthorized');
    await AgentService.deleteAgent(req.user.id, req.params.id);
    res.status(200).json({
      success: true,
      message: 'Agent deleted successfully',
    });
  }
}
