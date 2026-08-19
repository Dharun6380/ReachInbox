import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/db';
import { addEmailJobToQueue } from '../services/queue';

export async function createCampaign(req: AuthRequest, res: Response) {
  const { subject, body, recipients, startTime, delaySeconds, hourlyLimit } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (!subject || !body || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ error: 'Subject, body, and a non-empty recipients array are required.' });
  }

  const parsedDelay = parseInt(delaySeconds, 10);
  const parsedHourlyLimit = parseInt(hourlyLimit, 10);
  const parsedStartTime = new Date(startTime);

  if (isNaN(parsedDelay) || parsedDelay < 0) {
    return res.status(400).json({ error: 'Delay seconds must be a positive integer.' });
  }

  if (isNaN(parsedHourlyLimit) || parsedHourlyLimit <= 0) {
    return res.status(400).json({ error: 'Hourly limit must be a positive integer greater than zero.' });
  }

  if (isNaN(parsedStartTime.getTime())) {
    return res.status(400).json({ error: 'Start time is invalid.' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User record not found.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const campaign = await tx.emailCampaign.create({
        data: {
          userId,
          subject,
          body,
          delaySeconds: parsedDelay,
          hourlyLimit: parsedHourlyLimit,
          status: 'PENDING',
        },
      });

      const jobsData = recipients.map((recipient: string, index: number) => {
        const jobScheduledTime = new Date(parsedStartTime.getTime() + index * parsedDelay * 1000);
        return {
          campaignId: campaign.id,
          recipient: recipient.trim().toLowerCase(),
          scheduledAt: jobScheduledTime,
          status: 'PENDING',
        };
      });

      await tx.emailJob.createMany({
        data: jobsData,
      });

      const createdJobs = await tx.emailJob.findMany({
        where: { campaignId: campaign.id },
      });

      return { campaign, createdJobs };
    });

    console.log(`Created campaign ${result.campaign.id} with ${result.createdJobs.length} jobs.`);

    const now = Date.now();
    for (const job of result.createdJobs) {
      const delayMs = job.scheduledAt.getTime() - now;
      await addEmailJobToQueue(job.id, delayMs);
    }

    return res.status(201).json({
      message: 'Campaign scheduled successfully.',
      campaign: result.campaign,
      jobsCount: result.createdJobs.length,
    });

  } catch (error: any) {
    console.error('Error creating campaign:', error);
    return res.status(500).json({ error: 'Failed to create campaign.', details: error.message });
  }
}

export async function getCampaigns(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const campaigns = await prisma.emailCampaign.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    const campaignsWithStats = await Promise.all(
      campaigns.map(async (c) => {
        const counts = await prisma.emailJob.groupBy({
          by: ['status'],
          where: { campaignId: c.id },
          _count: true,
        });

        const stats = { pending: 0, sent: 0, failed: 0 };
        counts.forEach((item) => {
          if (item.status === 'PENDING') stats.pending = item._count;
          else if (item.status === 'SENT') stats.sent = item._count;
          else if (item.status === 'FAILED') stats.failed = item._count;
        });

        return {
          ...c,
          stats,
        };
      })
    );

    return res.status(200).json(campaignsWithStats);
  } catch (error: any) {
    console.error('Error fetching campaigns:', error);
    return res.status(500).json({ error: 'Failed to fetch campaigns.' });
  }
}

export async function getJobs(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  const status = req.query.status as string;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const whereClause: any = {
      campaign: {
        userId,
      },
    };

    if (status) {
      if (status === 'SENT_OR_FAILED') {
        whereClause.status = { in: ['SENT', 'FAILED'] };
      } else {
        whereClause.status = status;
      }
    }

    const jobs = await prisma.emailJob.findMany({
      where: whereClause,
      include: {
        campaign: {
          select: {
            subject: true,
          },
        },
      },
      orderBy: {
        scheduledAt: 'desc',
      },
    });

    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      email: job.recipient,
      subject: job.campaign.subject,
      scheduledAt: job.scheduledAt,
      sentAt: job.sentAt,
      status: job.status,
      error: job.errorMessage,
    }));

    return res.status(200).json(formattedJobs);
  } catch (error: any) {
    console.error('Error fetching email jobs:', error);
    return res.status(500).json({ error: 'Failed to fetch email jobs.' });
  }
}

export async function getDashboardStats(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    const campaignsCount = await prisma.emailCampaign.count({ where: { userId } });

    const jobCounts = await prisma.emailJob.groupBy({
      by: ['status'],
      where: {
        campaign: {
          userId,
        },
      },
      _count: true,
    });

    const stats = {
      campaigns: campaignsCount,
      pending: 0,
      sent: 0,
      failed: 0,
    };

    jobCounts.forEach((item) => {
      if (item.status === 'PENDING') stats.pending = item._count;
      else if (item.status === 'SENT') stats.sent = item._count;
      else if (item.status === 'FAILED') stats.failed = item._count;
    });

    return res.status(200).json(stats);
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats.' });
  }
}
