import { AppDataSource } from './data-source';

export interface DatabaseHealth {
  isHealthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Connect to PostgreSQL via TypeORM DataSource
 */
export async function connectDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }
}

/**
 * Disconnect from PostgreSQL cleanly
 */
export async function disconnectDatabase(): Promise<void> {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

/**
 * Perform a database health probe
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!AppDataSource.isInitialized) {
    return {
      isHealthy: false,
      error: 'Database connection is not initialized',
    };
  }

  const start = Date.now();
  try {
    await AppDataSource.query('SELECT 1');
    return {
      isHealthy: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      isHealthy: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
