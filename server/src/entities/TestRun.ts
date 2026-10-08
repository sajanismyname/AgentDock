import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Agent } from './Agent';
import { User } from './User';
import { TestResult } from './TestResult';

export type SuiteType = 'all' | 'regression';
export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'timeout';

export interface TestRunResponseDto {
  id: string;
  agentId: string;
  userId: string;
  suiteType: SuiteType;
  status: RunStatus;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  score: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('test_runs')
export class TestRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId!: string;

  @ManyToOne(() => Agent, (agent) => agent.testRuns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'agent_id' })
  agent!: Agent;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'suite_type',
    type: 'enum',
    enum: ['all', 'regression'],
    default: 'all',
  })
  suiteType!: SuiteType;

  @Column({
    type: 'enum',
    enum: ['queued', 'running', 'completed', 'failed', 'timeout'],
    default: 'queued',
  })
  status!: RunStatus;

  @Column({ name: 'total_tests', type: 'int', default: 0 })
  totalTests!: number;

  @Column({ name: 'passed_tests', type: 'int', default: 0 })
  passedTests!: number;

  @Column({ name: 'failed_tests', type: 'int', default: 0 })
  failedTests!: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  score!: number | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => TestResult, (result) => result.testRun, { cascade: true })
  results!: TestResult[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  toJSON(): TestRunResponseDto {
    return {
      id: this.id,
      agentId: this.agentId,
      userId: this.userId,
      suiteType: this.suiteType,
      status: this.status,
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      score: this.score !== null ? Number(this.score) : null,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
