import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const isProd = process.env.NODE_ENV === 'production';
const sslEnabled = process.env.DATABASE_SSL === 'true' || isProd;
const ssl = sslEnabled ? { rejectUnauthorized: false } : false;

const baseConfig: DataSourceOptions = {
  type: 'postgres',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: !isProd,
  ssl,
};

const config: DataSourceOptions = databaseUrl
  ? { ...baseConfig, url: databaseUrl }
  : {
      ...baseConfig,
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    };

export const AppDataSource = new DataSource(config);
