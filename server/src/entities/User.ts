import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface UserResponseDto {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  /**
   * Password hash is excluded from default queries (select: false)
   * to guarantee it is never accidentally included in API responses or logs.
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  /**
   * Hash of active refresh token.
   * Enables immediate revocation on logout or rotation.
   */
  @Column({ name: 'refresh_token_hash', type: 'varchar', length: 255, nullable: true, select: false })
  refreshTokenHash!: string | null;

  /**
   * Token version incremented to invalidate all active tokens for this user.
   */
  @Column({ name: 'token_version', type: 'int', default: 0 })
  tokenVersion!: number;

  /**
   * Hash of single-use password reset token.
   */
  @Column({ name: 'password_reset_token_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordResetTokenHash!: string | null;

  /**
   * Password reset expiration timestamp.
   */
  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true })
  passwordResetExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  /**
   * Safe serialization: guarantees secrets are never returned.
   */
  toJSON(): UserResponseDto {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
