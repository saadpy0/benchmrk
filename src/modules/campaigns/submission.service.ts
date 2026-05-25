import { Platform, SubmissionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { buildSubmissionTrackingJobs } from './submission-tracking.service.js';

export async function submitContent(
  userId: string,
  campaignId: string,
  platform: 'INSTAGRAM' | 'YOUTUBE',
  contentUrl: string
) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

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