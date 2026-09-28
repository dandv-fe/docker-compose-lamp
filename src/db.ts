import 'dotenv/config';
import mysql, { type PoolConnection } from 'mysql2/promise';
import { fail } from './services/errors.js';

const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'] as const;
export function assertDbConfiguration() {
  const missing = required.filter((key) => process.env[key] === undefined);
  if (missing.length) fail('CONFIGURATION_ERROR', `Missing database configuration: ${missing.join(', ')}`);
}

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: Number(process.env.DB_POOL_SIZE ?? 10),
  waitForConnections: true,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  enableKeepAlive: true,
});

export async function getConnection(): Promise<PoolConnection> {
  assertDbConfiguration();
  return pool.getConnection();
}
