import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAgentDockCoreSchema1700000000002 implements MigrationInterface {
  name = 'CreateAgentDockCoreSchema1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Agents table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "agents" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" UUID NOT NULL,
        "name" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "endpoint" VARCHAR(2048) NOT NULL,
        "encrypted_credential" TEXT,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_agents_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_agents_user_id" ON "agents" ("user_id");
    `);

    // 2. Rules table & ENUM
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "rules_type_enum" AS ENUM ('forbidden_action', 'requires_approval', 'data_restriction', 'tool_restriction');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "rules" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID NOT NULL,
        "type" "rules_type_enum" NOT NULL,
        "description" TEXT NOT NULL,
        "config" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_rules_agent" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_rules_agent_id" ON "rules" ("agent_id");
    `);

    // 3. TestCase table & ENUMs
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "test_cases_archetype_enum" AS ENUM ('direct_request', 'authority_claim', 'instruction_override', 'urgency', 'false_approval');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "test_cases_eval_type_enum" AS ENUM ('deterministic', 'llm');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "test_cases" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID NOT NULL,
        "rule_id" UUID,
        "archetype" "test_cases_archetype_enum" NOT NULL DEFAULT 'direct_request',
        "prompt" TEXT NOT NULL,
        "expected_behavior" TEXT NOT NULL,
        "evaluation_type" "test_cases_eval_type_enum" NOT NULL DEFAULT 'deterministic',
        "is_regression" BOOLEAN NOT NULL DEFAULT FALSE,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_test_cases_agent" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_test_cases_rule" FOREIGN KEY ("rule_id") REFERENCES "rules" ("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "idx_test_cases_agent_id" ON "test_cases" ("agent_id");
      CREATE INDEX IF NOT EXISTS "idx_test_cases_rule_id" ON "test_cases" ("rule_id");
      CREATE INDEX IF NOT EXISTS "idx_test_cases_is_regression" ON "test_cases" ("is_regression");
    `);

    // 4. TestRun table & ENUMs
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "test_runs_suite_type_enum" AS ENUM ('all', 'regression');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "test_runs_status_enum" AS ENUM ('queued', 'running', 'completed', 'failed', 'timeout');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "test_runs" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "agent_id" UUID NOT NULL,
        "user_id" UUID NOT NULL,
        "suite_type" "test_runs_suite_type_enum" NOT NULL DEFAULT 'all',
        "status" "test_runs_status_enum" NOT NULL DEFAULT 'queued',
        "total_tests" INT NOT NULL DEFAULT 0,
        "passed_tests" INT NOT NULL DEFAULT 0,
        "failed_tests" INT NOT NULL DEFAULT 0,
        "score" NUMERIC(5, 2),
        "started_at" TIMESTAMPTZ,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_test_runs_agent" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_test_runs_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_test_runs_agent_id" ON "test_runs" ("agent_id");
      CREATE INDEX IF NOT EXISTS "idx_test_runs_user_id" ON "test_runs" ("user_id");
    `);

    // 5. TestResult table & ENUM
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "test_results_status_enum" AS ENUM ('PASS', 'WARNING', 'CRITICAL_FAILURE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "test_results" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "test_run_id" UUID NOT NULL,
        "test_case_id" UUID NOT NULL,
        "status" "test_results_status_enum" NOT NULL,
        "request_payload" JSONB NOT NULL,
        "response_payload" JSONB NOT NULL,
        "tool_calls" JSONB,
        "explanation" JSONB NOT NULL,
        "technical_details" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "fk_test_results_test_run" FOREIGN KEY ("test_run_id") REFERENCES "test_runs" ("id") ON DELETE CASCADE,
        CONSTRAINT "fk_test_results_test_case" FOREIGN KEY ("test_case_id") REFERENCES "test_cases" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "idx_test_results_test_run_id" ON "test_results" ("test_run_id");
      CREATE INDEX IF NOT EXISTS "idx_test_results_test_case_id" ON "test_results" ("test_case_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "test_results";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_results_status_enum";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "test_runs";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_runs_status_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_runs_suite_type_enum";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "test_cases";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_cases_eval_type_enum";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "test_cases_archetype_enum";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "rules";`);
    await queryRunner.query(`DROP TYPE IF EXISTS "rules_type_enum";`);

    await queryRunner.query(`DROP TABLE IF EXISTS "agents";`);
  }
}
