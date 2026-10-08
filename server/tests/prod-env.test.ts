import { describe, it, expect } from 'vitest';
import { validateProductionSecrets, EnvConfig } from '../src/config/env';

describe('Priority 3: Production Secret Validation Tests', () => {
  const baseValidProdConfig: EnvConfig = {
    PORT: 3000,
    NODE_ENV: 'production',
    CORS_ORIGIN: 'https://agentdock.example.com',
    DB_HOST: 'postgres.production.internal',
    DB_PORT: 5432,
    DB_USERNAME: 'agentdock_prod',
    DB_PASSWORD: 'SuperSecureProdDbPassword2026!#',
    DB_NAME: 'agentdock_prod',
    DB_SSL: true,
    DB_LOGGING: false,
    REDIS_HOST: 'valkey.production.internal',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: 'SuperSecureRedisPassword2026!#',
    REDIS_DB: 0,
    RATE_LIMIT_WINDOW_MS: 900000,
    RATE_LIMIT_MAX: 100,
    JWT_ACCESS_SECRET: 'prod-jwt-access-secret-64-character-entropy-string-for-security-test',
    JWT_REFRESH_SECRET: 'prod-jwt-refresh-secret-64-character-entropy-string-for-security-test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
    AUTH_RATE_LIMIT_WINDOW_MS: 900000,
    AUTH_RATE_LIMIT_MAX: 10,
    AGENT_ENCRYPTION_KEY: 'prod-aes-256-gcm-key-32-byte-hex-encoded-string-for-safety-check',
  };

  it('should pass validation when strong production secrets are provided', () => {
    expect(() => validateProductionSecrets(baseValidProdConfig)).not.toThrow();
  });

  it('should reject default dev encryption key in production', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      AGENT_ENCRYPTION_KEY: 'agentdock-dev-encryption-key-32b-secret-min',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: ENCRYPTION_KEY cannot use default or placeholder values.'
    );
  });

  it('should reject short encryption key in production (< 32 chars)', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      AGENT_ENCRYPTION_KEY: 'too-short-key',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: ENCRYPTION_KEY must have at least 32 characters'
    );
  });

  it('should reject common placeholder keys like "changeme" or "secret"', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      AGENT_ENCRYPTION_KEY: 'changeme',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: ENCRYPTION_KEY cannot use default or placeholder values.'
    );
  });

  it('should reject default dev JWT access secret in production', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      JWT_ACCESS_SECRET: 'agentdock-dev-jwt-access-secret-32-chars-min',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: JWT_ACCESS_SECRET cannot use default or placeholder values.'
    );
  });

  it('should reject short JWT access secret in production (< 32 chars)', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      JWT_ACCESS_SECRET: 'short-secret-key',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: JWT_ACCESS_SECRET must have at least 32 characters of entropy.'
    );
  });

  it('should reject default dev JWT refresh secret in production', () => {
    const config: EnvConfig = {
      ...baseValidProdConfig,
      JWT_REFRESH_SECRET: 'agentdock-dev-jwt-refresh-secret-32-chars-min',
    };

    expect(() => validateProductionSecrets(config)).toThrow(
      'Production Configuration Error: JWT_REFRESH_SECRET cannot use default or placeholder values.'
    );
  });

  it('should not throw in development or test mode for convenient defaults', () => {
    const devConfig: EnvConfig = {
      ...baseValidProdConfig,
      NODE_ENV: 'development',
      AGENT_ENCRYPTION_KEY: 'agentdock-dev-encryption-key-32b-secret-min',
      JWT_ACCESS_SECRET: 'agentdock-dev-jwt-access-secret-32-chars-min',
      JWT_REFRESH_SECRET: 'agentdock-dev-jwt-refresh-secret-32-chars-min',
    };

    expect(() => validateProductionSecrets(devConfig)).not.toThrow();

    const testConfig: EnvConfig = {
      ...devConfig,
      NODE_ENV: 'test',
    };

    expect(() => validateProductionSecrets(testConfig)).not.toThrow();
  });

  it('should never expose secret values in configuration error messages', () => {
    const secretValue = 'custom-sensitive-secret-that-must-never-appear-in-logs-123';
    const config: EnvConfig = {
      ...baseValidProdConfig,
      AGENT_ENCRYPTION_KEY: 'changeme',
      JWT_ACCESS_SECRET: secretValue.substring(0, 10), // too short
    };

    try {
      validateProductionSecrets(config);
    } catch (err) {
      const message = (err as Error).message;
      expect(message).not.toContain(secretValue);
      expect(message).not.toContain(config.AGENT_ENCRYPTION_KEY);
    }
  });
});
