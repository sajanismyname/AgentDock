import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPendingToTestRunStatus1700000000003 implements MigrationInterface {
  name = 'AddPendingToTestRunStatus1700000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "test_runs_status_enum" ADD VALUE IF NOT EXISTS 'pending' BEFORE 'queued';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL ENUM values cannot be easily removed without recreating the type, which is unnecessary for down migration.
  }
}
