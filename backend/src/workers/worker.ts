import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { prisma } from '../config/db';
import { sendEmail } from '../services/mailer';
import { addEmailJobToQueue, QUEUE_NAME } from '../services/queue';
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const redisClient = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    })
  : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });

const concurrency = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

export const emailWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { emailJobId } = job.data;
    console.log(`Processing email job: ${emailJobId}`);

    const emailJob = await prisma.emailJob.findUnique({
      where: { id: emailJobId },
      include: {
        campaign: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!emailJob) {
      console.warn(`Email job ${emailJobId} not found in database. Skipping.`);
      return;
    }

    if (emailJob.status !== 'PENDING') {
      console.log(`Email job ${emailJobId} is already processed (Status: ${emailJob.status}). Skipping.`);
      return;
    }

    const { campaign } = emailJob;
    const sender = campaign.user;

    // Enforce Hourly Rate Limit
    const currentHourTimestamp = Math.floor(Date.now() / 3600000);
    const rateLimitKey = `ratelimit:${sender.id}:${currentHourTimestamp}`;
    
    const currentCountStr = await redisClient.get(rateLimitKey);
    const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
    const hourlyLimit = campaign.hourlyLimit;

    if (currentCount >= hourlyLimit) {
      const nextHourStartMs = (currentHourTimestamp + 1) * 3600000;
      const delayMs = nextHourStartMs - Date.now();
      
      console.log(
        `Rate limit reached for sender ${sender.email} (${currentCount}/${hourlyLimit}). ` +
        `Rescheduling job ${emailJobId} to start of next hour (in ${Math.round(delayMs / 1000)} seconds).`
      );

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          scheduledAt: new Date(nextHourStartMs),
        },
      });

      await addEmailJobToQueue(emailJobId, delayMs);
      return;
    }

    // Increment count & expire after 2h
    await redisClient.incr(rateLimitKey);
    await redisClient.expire(rateLimitKey, 7200);

    if (campaign.status === 'PENDING') {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'PROCESSING' },
      });
    }

    try {
      const sendResult = await sendEmail(
        emailJob.recipient,
        campaign.subject,
        campaign.body,
        sender.name,
        sender.email
      );

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          errorMessage: sendResult.previewUrl ? `Preview URL: ${sendResult.previewUrl}` : null,
        },
      });

      console.log(`Successfully sent email to ${emailJob.recipient} (Preview: ${sendResult.previewUrl})`);
      await checkAndUpdateCampaignStatus(campaign.id);

    } catch (error: any) {
      console.error(`Failed to send email to ${emailJob.recipient}:`, error);

      await prisma.emailJob.update({
        where: { id: emailJobId },
        data: {
          status: 'FAILED',
          errorMessage: error.message || 'Unknown SMTP error',
        },
      });

      await checkAndUpdateCampaignStatus(campaign.id);
    }
  },
  {
    connection: redisConfig,
    concurrency,
  }
);

async function checkAndUpdateCampaignStatus(campaignId: string) {
  const remainingPending = await prisma.emailJob.count({
    where: {
      campaignId,
      status: 'PENDING',
    },
  });

  if (remainingPending === 0) {
    const failedCount = await prisma.emailJob.count({
      where: {
        campaignId,
        status: 'FAILED',
      },
    });

    const finalStatus = failedCount > 0 ? 'FAILED' : 'COMPLETED';

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: { status: finalStatus },
    });

    console.log(`Campaign ${campaignId} completed with status: ${finalStatus}`);
  }
}

emailWorker.on('completed', (job) => {
  console.log(`BullMQ Job ${job.id} completed.`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`BullMQ Job ${job?.id} failed:`, err);
});
