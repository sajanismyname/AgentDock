import http from 'http';
import { app } from './app';
import { env, getSanitizedConfig } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './config/redis';

let server: http.Server | null = null;

async function startServer(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('[Server] Starting AgentDock backend foundation...');
  // eslint-disable-next-line no-console
  console.log('[Server] Configuration:', JSON.stringify(getSanitizedConfig(), null, 2));

  // Connect to Database
  try {
    await connectDatabase();
    // eslint-disable-next-line no-console
    console.log('[Database] Connected to PostgreSQL successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      '[Database] Initial connection failed:',
      error instanceof Error ? error.message : error
    );
    // eslint-disable-next-line no-console
    console.warn('[Database] Continuing startup; health check will report degraded status.');
  }

  // Initialize Redis
  try {
    const redis = getRedisClient();
    if (redis.status === 'wait') {
      await redis.connect();
    }
    // eslint-disable-next-line no-console
    console.log('[Redis] Connected to Redis successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Redis] Initial connection failed:',
      error instanceof Error ? error.message : error
    );
    // eslint-disable-next-line no-console
    console.warn('[Redis] Continuing startup; health check will report degraded status.');
  }

  // Start HTTP listener
  server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[Server] AgentDock API listening on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  });

  // Handle graceful shutdowns
  const handleShutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`[Server] Received ${signal}. Initiating graceful shutdown...`);

    if (server) {
      server.close(() => {
        // eslint-disable-next-line no-console
        console.log('[Server] HTTP listener closed.');
      });
    }

    try {
      await disconnectDatabase();
      // eslint-disable-next-line no-console
      console.log('[Database] Disconnected.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Database] Error during disconnect:', err);
    }

    try {
      await disconnectRedis();
      // eslint-disable-next-line no-console
      console.log('[Redis] Disconnected.');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[Redis] Error during disconnect:', err);
    }

    // eslint-disable-next-line no-console
    console.log('[Server] Graceful shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  });
}
