import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './Agent';

export type RuleType =
  | 'forbidden_action'
  | 'requires_approval'
  | 'data_restriction'
  | 'tool_restriction';

export interface RuleConfig {
  toolName?: string;
  keywords?: string[];
  approvalThreshold?: string;
  restrictedData?: string;
  [key: string]: unknown;
}

export interface RuleResponseDto {
  id: string;
  agentId: string;
  type: RuleType;
  description: string;
  config: RuleConfig;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('rules')
export class Rule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.rules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Column({
    type: 'enum',
    enum: ['forbidden_action', 'requires_approval', 'data_restriction', 'tool_restriction'],
  })
  type!: RuleType;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb', default: {} })
  config!: RuleConfig;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  toJSON(): RuleResponseDto {
    return {
      id: this.id,
      agentId: this.agentId,
      type: this.type,
      description: this.description,
      config: this.config || {},
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
