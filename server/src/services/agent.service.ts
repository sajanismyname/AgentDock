import { AppDataSource } from '../config/data-source';
import { Agent, AgentResponseDto } from '../entities/Agent';
import { NotFoundError } from '../errors/AppError';
import { EncryptionService } from './encryption.service';
import { SafeHttpClient } from '../utils/safeHttpClient';

export interface CreateAgentDto {
  name: string;
  description?: string | null;
  endpoint: string;
  credential?: string | null;
}

export interface UpdateAgentDto {
  name?: string;
  description?: string | null;
  endpoint?: string;
  credential?: string | null;
}

export class AgentService {
  private static getRepository() {
    return AppDataSource.getRepository(Agent);
  }

  static async createAgent(userId: string, dto: CreateAgentDto): Promise<AgentResponseDto> {
    const repository = this.getRepository();

    // Validate endpoint format
    await SafeHttpClient.validateUrl(dto.endpoint);

    const encryptedCredential = dto.credential
      ? EncryptionService.encrypt(dto.credential.trim())
      : null;

    const agent = repository.create({
      userId,
      name: dto.name.trim(),
      description: dto.description ? dto.description.trim() : null,
      endpoint: dto.endpoint.trim(),
      encryptedCredential,
    });

    await repository.save(agent);
    return agent.toJSON(Boolean(dto.credential));
  }

  static async listAgents(userId: string): Promise<AgentResponseDto[]> {
    const repository = this.getRepository();
    const agents = await repository
      .createQueryBuilder('agent')
      .where('agent.userId = :userId', { userId })
      .orderBy('agent.createdAt', 'DESC')
      .getMany();

    return agents.map((agent) => agent.toJSON());
  }

  static async getAgentById(userId: string, agentId: string): Promise<AgentResponseDto> {
    const repository = this.getRepository();
    const agent = await repository
      .createQueryBuilder('agent')
      .where('agent.id = :agentId', { agentId })
      .andWhere('agent.userId = :userId', { userId })
      .getOne();

    if (!agent) {
      throw new NotFoundError('Agent not found or unauthorized');
    }

    return agent.toJSON();
  }

  static async updateAgent(
    userId: string,
    agentId: string,
    dto: UpdateAgentDto
  ): Promise<AgentResponseDto> {
    const repository = this.getRepository();
    const agent = await repository
      .createQueryBuilder('agent')
      .where('agent.id = :agentId', { agentId })
      .andWhere('agent.userId = :userId', { userId })
      .getOne();

    if (!agent) {
      throw new NotFoundError('Agent not found or unauthorized');
    }

    if (dto.endpoint && dto.endpoint !== agent.endpoint) {
      await SafeHttpClient.validateUrl(dto.endpoint);
      agent.endpoint = dto.endpoint.trim();
    }

    if (dto.name !== undefined) {
      agent.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      agent.description = dto.description ? dto.description.trim() : null;
    }

    if (dto.credential !== undefined) {
      agent.encryptedCredential = dto.credential
        ? EncryptionService.encrypt(dto.credential.trim())
        : null;
    }

    await repository.save(agent);
    return agent.toJSON();
  }

  static async deleteAgent(userId: string, agentId: string): Promise<void> {
    const repository = this.getRepository();
    const agent = await repository
      .createQueryBuilder('agent')
      .where('agent.id = :agentId', { agentId })
      .andWhere('agent.userId = :userId', { userId })
      .getOne();

    if (!agent) {
      throw new NotFoundError('Agent not found or unauthorized');
    }

    await repository.remove(agent);
  }

  static async getDecryptedCredential(userId: string, agentId: string): Promise<string | null> {
    const repository = this.getRepository();
    const agent = await repository
      .createQueryBuilder('agent')
      .addSelect('agent.encryptedCredential')
      .where('agent.id = :agentId', { agentId })
      .andWhere('agent.userId = :userId', { userId })
      .getOne();

    if (!agent || !agent.encryptedCredential) {
      return null;
    }

    return EncryptionService.decrypt(agent.encryptedCredential);
  }
}
