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
import { User } from './User';
import { Rule } from './Rule';
import { TestCase } from './TestCase';
import { TestRun } from './TestRun';

export interface AgentResponseDto {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  endpoint: string;
  hasCredential: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('agents')
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 2048 })
  endpoint!: string;

  /**
   * Stored as AES-256-GCM ciphertext (iv:authTag:cipher).
   * select: false ensures credentials are never accidentally fetched or serialized.
   */
  @Column({ name: 'encrypted_credential', type: 'text', nullable: true, select: false })
  encryptedCredential!: string | null;

  @OneToMany(() => Rule, (rule) => rule.agent, { cascade: true })
  rules!: Rule[];

  @OneToMany(() => TestCase, (testCase) => testCase.agent, { cascade: true })
  testCases!: TestCase[];

  @OneToMany(() => TestRun, (testRun) => testRun.agent, { cascade: true })
  testRuns!: TestRun[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  toJSON(hasCredentialOverride?: boolean): AgentResponseDto {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      description: this.description,
      endpoint: this.endpoint,
      hasCredential:
        hasCredentialOverride !== undefined
          ? hasCredentialOverride
          : Boolean(this.encryptedCredential),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
