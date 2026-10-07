import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1700000000001 implements MigrationInterface {
  name = 'CreateUsersTable1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" VARCHAR(255) NOT NULL UNIQUE,
        "password_hash" VARCHAR(255) NOT NULL,
        "refresh_token_hash" VARCHAR(255),
        "token_version" INT NOT NULL DEFAULT 0,
        "password_reset_token_hash" VARCHAR(255),
        "password_reset_expires_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_users_email";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users";`);
  }
}
