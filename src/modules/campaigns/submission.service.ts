import { prisma } from '../../lib/prisma.js';

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

  return prisma.contentSubmission.create({
    data: { campaignId, creatorId: creatorProfile.id, platform, contentUrl },
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