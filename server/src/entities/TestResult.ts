import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TestRun } from './TestRun';
import { TestCase } from './TestCase';

export type ResultStatus = 'PASS' | 'WARNING' | 'CRITICAL_FAILURE';

export interface FailureExplanation {
  whatTested: string;
  whatShouldHaveHappened: string;
  whatHappened: string;
  whyFailed: string;
}

export interface TechnicalDetails {
  durationMs: number;
  httpStatus?: number;
  rawRequest?: unknown;
  rawResponse?: unknown;
  evaluatorOutput?: string;
  error?: string;
  [key: string]: unknown;
}

export interface TestResultResponseDto {
  id: string;
  testRunId: string;
  testCaseId: string;
  status: ResultStatus;
  requestPayload: unknown;
  responsePayload: unknown;
  toolCalls: unknown | null;
  explanation: FailureExplanation;
  technicalDetails: TechnicalDetails;
  testCase?: unknown;
  createdAt: Date;
}

@Entity('test_results')
export class TestResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'test_run_id', type: 'uuid' })
  testRunId!: string;

  @ManyToOne(() => TestRun, (run) => run.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_run_id' })
  testRun!: TestRun;

  @Index()
  @Column({ name: 'test_case_id', type: 'uuid' })
  testCaseId!: string;

  @ManyToOne(() => TestCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_case_id' })
  testCase!: TestCase;

  @Column({
    type: 'enum',
    enum: ['PASS', 'WARNING', 'CRITICAL_FAILURE'],
  })
  status!: ResultStatus;

  @Column({ name: 'request_payload', type: 'jsonb' })
  requestPayload!: unknown;

  @Column({ name: 'response_payload', type: 'jsonb' })
  responsePayload!: unknown;

  @Column({ name: 'tool_calls', type: 'jsonb', nullable: true })
  toolCalls!: unknown | null;

  @Column({ type: 'jsonb' })
  explanation!: FailureExplanation;

  @Column({ name: 'technical_details', type: 'jsonb', default: {} })
  technicalDetails!: TechnicalDetails;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  toJSON(): TestResultResponseDto {
    return {
      id: this.id,
      testRunId: this.testRunId,
      testCaseId: this.testCaseId,
      status: this.status,
      requestPayload: this.requestPayload,
      responsePayload: this.responsePayload,
      toolCalls: this.toolCalls,
      explanation: this.explanation,
      technicalDetails: this.technicalDetails,
      testCase: this.testCase ? this.testCase.toJSON() : undefined,
      createdAt: this.createdAt,
    };
  }
}
