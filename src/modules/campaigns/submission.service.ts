import { Platform, SubmissionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { buildSubmissionTrackingJobs } from './submission-tracking.service.js';

async function getReleasedSpendForCampaign(campaignId: string) {
  const entries = await (prisma.balanceLedgerEntry as any).findMany({
    where: {
      entryType: 'RELEASE_TO_AVAILABLE',
      reviewBatch: {
        campaignId,
      },
    },
  });

  return entries.reduce((sum: number, entry: any) => sum + Number(entry.amount ?? 0), 0);
}

export async function submitContent(
  userId: string,
  campaignId: string,
  platform: 'INSTAGRAM' | 'YOUTUBE',
  contentUrl: string
) {
  const [creatorProfile, campaign] = await Promise.all([
    prisma.creatorProfile.findUnique({ where: { userId } }),
    prisma.campaign.findUnique({ where: { id: campaignId } }),
  ]);
  if (!creatorProfile) throw new Error('Creator profile not found');
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'LIVE') throw new Error('Campaign is not live');

  const remainingBudget = Math.max(Number(campaign.totalBudget ?? 0) - await getReleasedSpendForCampaign(campaignId), 0);
  if (remainingBudget <= 0) throw new Error('Campaign budget is exhausted');

  const application = await prisma.application.findUnique({
    where: { campaignId_creatorId: { campaignId, creatorId: creatorProfile.id } },
  });
  if (!application) throw new Error('You must apply to this campaign before submitting');
  if (application.status !== 'ACCEPTED') throw new Error('Your application has not been accepted yet');

  return prisma.$transaction(async (tx) => {
    const submission = await tx.contentSubmission.create({
      data: {
        campaignId,
        creatorId: creatorProfile.id,
        platform,
        contentUrl,
        status: SubmissionStatus.UNDER_REVIEW,
      },
    });

    await (tx as any).submissionTrackingJob.createMany({
      data: buildSubmissionTrackingJobs(submission.createdAt).map((job) => ({
        submissionId: submission.id,
        sequence: job.sequence,
        checkpointLabel: job.checkpointLabel,
        scheduledFor: job.scheduledFor,
      })),
    });

    return submission;
  });
}

export async function getMySubmissions(userId: string) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

  return prisma.contentSubmission.findMany({
    where: { creatorId: creatorProfile.id },
    include: { campaign: { select: { title: true, cpvRate: true } } },
    orderBy: { createdAt: 'desc' },
  });
}