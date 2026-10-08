import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env';
import { User } from '../entities/User';
import { Agent } from '../entities/Agent';
import { Rule } from '../entities/Rule';
import { TestCase } from '../entities/TestCase';
import { TestRun } from '../entities/TestRun';
import { TestResult } from '../entities/TestResult';
import { InitDatabase1700000000000 } from '../migrations/1700000000000-InitDatabase';
import { CreateUsersTable1700000000001 } from '../migrations/1700000000001-CreateUsersTable';
import { CreateAgentDockCoreSchema1700000000002 } from '../migrations/1700000000002-CreateAgentDockCoreSchema';
import { AddPendingToTestRunStatus1700000000003 } from '../migrations/1700000000003-AddPendingToTestRunStatus';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USERNAME,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: env.DB_LOGGING,
  entities: [User, Agent, Rule, TestCase, TestRun, TestResult],
  migrations: [
    InitDatabase1700000000000,
    CreateUsersTable1700000000001,
    CreateAgentDockCoreSchema1700000000002,
    AddPendingToTestRunStatus1700000000003,
  ],
  subscribers: [],
};

export const AppDataSource = new DataSource(dataSourceOptions);
