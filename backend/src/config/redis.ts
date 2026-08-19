import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

let parsedConfig: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
};

if (process.env.REDIS_URL) {
  try {
    const parsed = new URL(process.env.REDIS_URL);
    parsedConfig = {
      host: parsed.hostname,
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    };
  } catch (error) {
    console.error('Failed to parse REDIS_URL environment variable:', error);
  }
}

export const redisConfig = parsedConfig;
