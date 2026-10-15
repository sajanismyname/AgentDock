import { AppDataSource } from '../config/data-source';
import { Rule, RuleType, RuleConfig, RuleResponseDto } from '../entities/Rule';
import { AgentService } from './agent.service';
import { BadRequestError, NotFoundError } from '../errors/AppError';

export interface CreateRuleDto {
  type: RuleType;
  description: string;
  config?: RuleConfig;
}

export interface UpdateRuleDto {
  type?: RuleType;
  description?: string;
  config?: RuleConfig;
}

const MAX_RULES_PER_AGENT = 5;

export class RuleService {
  private static getRepository() {
    return AppDataSource.getRepository(Rule);
  }

  static async createRule(
    userId: string,
    agentId: string,
    dto: CreateRuleDto
  ): Promise<RuleResponseDto> {
    // Verify agent ownership
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRepository();

    // Enforce max 5 rules limit
    const currentRuleCount = await repository.count({ where: { agentId } });
    if (currentRuleCount >= MAX_RULES_PER_AGENT) {
      throw new BadRequestError(`Maximum limit of ${MAX_RULES_PER_AGENT} rules per agent reached.`);
    }

    const rule = repository.create({
      agentId,
      type: dto.type,
      description: dto.description.trim(),
      config: dto.config || {},
    });

    await repository.save(rule);
    return rule.toJSON();
  }

  static async listRules(userId: string, agentId: string): Promise<RuleResponseDto[]> {
    // Verify agent ownership
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRepository();
    const rules = await repository.find({
      where: { agentId },
      order: { createdAt: 'ASC' },
    });

    return rules.map((r) => r.toJSON());
  }

  static async getRuleById(
    userId: string,
    agentId: string,
    ruleId: string
  ): Promise<RuleResponseDto> {
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRepository();
    const rule = await repository.findOne({ where: { id: ruleId, agentId } });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    return rule.toJSON();
  }

  static async updateRule(
    userId: string,
    agentId: string,
    ruleId: string,
    dto: UpdateRuleDto
  ): Promise<RuleResponseDto> {
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRepository();
    const rule = await repository.findOne({ where: { id: ruleId, agentId } });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    if (dto.type) rule.type = dto.type;
    if (dto.description) rule.description = dto.description.trim();
    if (dto.config !== undefined) rule.config = dto.config;

    await repository.save(rule);
    return rule.toJSON();
  }

  static async deleteRule(userId: string, agentId: string, ruleId: string): Promise<void> {
    await AgentService.getAgentById(userId, agentId);

    const repository = this.getRepository();
    const rule = await repository.findOne({ where: { id: ruleId, agentId } });

    if (!rule) {
      throw new NotFoundError('Rule not found');
    }

    await repository.remove(rule);
  }
}
