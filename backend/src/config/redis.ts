import { ConnectionOptions } from 'bullmq';
import dotenv from 'dotenv';

dotenv.config();

export const redisConfig: ConnectionOptions = process.env.REDIS_URL 
  ? {
      connectionString: process.env.REDIS_URL,
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    } as any
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
