import type { CampaignStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { canTransition } from './campaign.state.js';
import { platformConfig } from '../../lib/platform-config.js';

export async function createCampaign(
  brandId: string,
  data: {
    title: string;
    description: string;
    guidelines: string;
    cpvRate: number;
    totalBudget: number;
    minimumPayoutViews?: number;
    maxPayoutPerSubmission?: number;
    startDate: string;
    endDate: string;
  }
) {
  const brandProfile = await prisma.brandProfile.findUnique({ where: { userId: brandId } });
  if (!brandProfile) throw new Error('Brand profile not found — complete your profile first');

  return (prisma.campaign as any).create({
    data: {
      brandId: brandProfile.id,
      title: data.title,
      description: data.description,
      guidelines: data.guidelines,
      cpvRate: data.cpvRate,
      totalBudget: data.totalBudget,
      minimumPayoutViews: data.minimumPayoutViews ?? 1000,
      maxPayoutPerSubmission: data.maxPayoutPerSubmission ?? 0,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: platformConfig.campaignReviewRequired ? 'PENDING_REVIEW' : 'LIVE',
    },
  });
}

export async function getCampaigns(status?: CampaignStatus) {
  return prisma.campaign.findMany({
    ...(status ? { where: { status } } : {}),
    include: { brand: { select: { companyName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getCampaignById(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { brand: { select: { companyName: true } } },
  });
  if (!campaign) throw new Error('Campaign not found');
  return campaign;
}

export async function getDiscoverCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: 'LIVE' },
    include: {
      brand: { select: { companyName: true } },
      submissions: {
        select: {
          creatorId: true,
          metricSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1,
            select: { viewCount: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (campaigns.length === 0) return [];

  // fetch verified spend for all campaigns in one query
  const campaignIds = campaigns.map(c => c.id);
  const ledgerEntries = await (prisma.balanceLedgerEntry as any).findMany({
    where: {
      entryType: 'RELEASE_TO_AVAILABLE',
      reviewBatch: { campaignId: { in: campaignIds } },
    },
    include: { reviewBatch: { select: { campaignId: true } } },
  });

  const spendMap = new Map<string, number>();
  for (const entry of ledgerEntries) {
    const cid = entry.reviewBatch?.campaignId;
    if (!cid) continue;
    spendMap.set(cid, (spendMap.get(cid) ?? 0) + Number(entry.amount ?? 0));
  }

  return campaigns.map(c => {
    const totalBudget = Number(c.totalBudget ?? 0);
    const spentBudget = spendMap.get(c.id) ?? 0;
    const remainingBudget = Math.max(totalBudget - spentBudget, 0);

    const uniqueCreators = new Set(c.submissions.map((s: any) => s.creatorId)).size;
    const totalViews = c.submissions.reduce((sum: number, s: any) => {
      const snap = s.metricSnapshots?.[0];
      return sum + Number(snap?.viewCount ?? 0);
    }, 0);

    return {
      id: c.id,
      title: c.title,
      description: c.description,
      cpvRate: Number(c.cpvRate),
      totalBudget,
      spentBudget,
      remainingBudget,
      minimumPayoutViews: Number(c.minimumPayoutViews ?? 0),
      maxPayoutPerSubmission: Number(c.maxPayoutPerSubmission ?? 0),
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      brand: { companyName: c.brand.companyName },
      creatorCount: uniqueCreators,
      totalViews,
    };
  });
}

export async function updateCampaignStatus(campaignId: string, newStatus: CampaignStatus) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  if (!canTransition(campaign.status, newStatus)) {
    throw new Error(`Cannot transition from ${campaign.status} to ${newStatus}`);
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: newStatus },
  });
}