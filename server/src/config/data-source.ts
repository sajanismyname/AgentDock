import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env';
import { User } from '../entities/User';
import { InitDatabase1700000000000 } from '../migrations/1700000000000-InitDatabase';
import { CreateUsersTable1700000000001 } from '../migrations/1700000000001-CreateUsersTable';

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
  entities: [User],
  migrations: [InitDatabase1700000000000, CreateUsersTable1700000000001],
  subscribers: [],
};

export const AppDataSource = new DataSource(dataSourceOptions);
