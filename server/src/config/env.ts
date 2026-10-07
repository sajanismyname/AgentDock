import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file from server root or process working directory
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // PostgreSQL
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_USERNAME: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  DB_NAME: z.string().default('agentdock'),
  DB_SSL: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),
  DB_LOGGING: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().default(100),
});

export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Never log raw process.env
  const errors = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
  throw new Error(`Invalid environment configuration: ${errors}`);
}

export const env: EnvConfig = parsed.data;

/**
 * Returns a sanitized copy of configuration with secrets masked for safe logging/inspection.
 */
export function getSanitizedConfig(): Record<string, unknown> {
  return {
    PORT: env.PORT,
    NODE_ENV: env.NODE_ENV,
    CORS_ORIGIN: env.CORS_ORIGIN,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_USERNAME: env.DB_USERNAME,
    DB_PASSWORD: env.DB_PASSWORD ? '********' : '',
    DB_NAME: env.DB_NAME,
    DB_SSL: env.DB_SSL,
    DB_LOGGING: env.DB_LOGGING,
    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
    REDIS_PASSWORD: env.REDIS_PASSWORD ? '********' : '',
    REDIS_DB: env.REDIS_DB,
    RATE_LIMIT_WINDOW_MS: env.RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_MAX: env.RATE_LIMIT_MAX,
  };
}
