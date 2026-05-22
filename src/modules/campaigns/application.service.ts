import { prisma } from '../../lib/prisma.js';

export async function applyToCampaign(userId: string, campaignId: string) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'LIVE') throw new Error('Campaign is not accepting applications');

  return prisma.application.create({
    data: { campaignId, creatorId: creatorProfile.id },
  });
}

export async function getMyApplications(userId: string) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

  return prisma.application.findMany({
    where: { creatorId: creatorProfile.id },
    include: { campaign: { select: { title: true, status: true, cpvRate: true } } },
    orderBy: { createdAt: 'desc' },
  });
}