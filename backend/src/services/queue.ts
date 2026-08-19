import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis';
import { prisma } from '../config/db';

export const QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export async function addEmailJobToQueue(jobId: string, delayMs: number) {
  await emailQueue.add(
    'send-email',
    { emailJobId: jobId },
    {
      jobId, // Native deduplication via database record ID
      delay: Math.max(0, delayMs),
    }
  );
}

export async function syncQueueWithDatabase() {
  console.log('Synchronizing BullMQ queue with database PENDING jobs...');
  try {
    const pendingJobs = await prisma.emailJob.findMany({
      where: { status: 'PENDING' },
    });

    console.log(`Found ${pendingJobs.length} PENDING jobs in database.`);

    let enqueuedCount = 0;
    for (const job of pendingJobs) {
      const existingJob = await emailQueue.getJob(job.id);
      if (!existingJob) {
        const delayMs = job.scheduledAt.getTime() - Date.now();
        await addEmailJobToQueue(job.id, delayMs);
        enqueuedCount++;
      }
    }

    console.log(`Queue synchronization completed. Re-enqueued ${enqueuedCount} missing jobs.`);
  } catch (error) {
    console.error('Error during queue synchronization:', error);
  }
}
