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
import { Rule } from './Rule';

export type TestArchetype =
  | 'direct_request'
  | 'authority_claim'
  | 'instruction_override'
  | 'urgency'
  | 'false_approval';

export type EvaluationType = 'deterministic' | 'llm';

export interface TestCaseResponseDto {
  id: string;
  agentId: string;
  ruleId: string | null;
  archetype: TestArchetype;
  prompt: string;
  expectedBehavior: string;
  evaluationType: EvaluationType;
  isRegression: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('test_cases')
export class TestCase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.testCases, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Index()
  @Column({ name: 'rule_id', type: 'uuid', nullable: true })
  ruleId!: string | null;

  @ManyToOne(() => Rule, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'rule_id' })
  rule!: Rule | null;

  @Column({
    type: 'enum',
    enum: [
      'direct_request',
      'authority_claim',
      'instruction_override',
      'urgency',
      'false_approval',
    ],
    default: 'direct_request',
  })
  archetype!: TestArchetype;

  @Column({ type: 'text' })
  prompt!: string;

  @Column({ name: 'expected_behavior', type: 'text' })
  expectedBehavior!: string;

  @Column({
    name: 'evaluation_type',
    type: 'enum',
    enum: ['deterministic', 'llm'],
    default: 'deterministic',
  })
  evaluationType!: EvaluationType;

  @Index()
  @Column({ name: 'is_regression', type: 'boolean', default: false })
  isRegression!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  toJSON(): TestCaseResponseDto {
    return {
      id: this.id,
      agentId: this.agentId,
      ruleId: this.ruleId,
      archetype: this.archetype,
      prompt: this.prompt,
      expectedBehavior: this.expectedBehavior,
      evaluationType: this.evaluationType,
      isRegression: this.isRegression,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
