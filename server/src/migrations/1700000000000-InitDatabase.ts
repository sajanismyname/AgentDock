import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDatabase1700000000000 implements MigrationInterface {
  name = 'InitDatabase1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp extension for UUID generation if supported
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reversible rollback
    await queryRunner.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
  }
}
