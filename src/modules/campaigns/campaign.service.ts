import { CampaignStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { canTransition } from './campaign.state.js';

export async function createCampaign(
  brandId: string,
  data: {
    title: string;
    description: string;
    guidelines: string;
    cpvRate: number;
    totalBudget: number;
    startDate: string;
    endDate: string;
  }
) {
  const brandProfile = await prisma.brandProfile.findUnique({ where: { userId: brandId } });
  if (!brandProfile) throw new Error('Brand profile not found — complete your profile first');

  return prisma.campaign.create({
    data: {
      brandId: brandProfile.id,
      title: data.title,
      description: data.description,
      guidelines: data.guidelines,
      cpvRate: data.cpvRate,
      totalBudget: data.totalBudget,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      status: 'DRAFT',
    },
  });
}

export async function getCampaigns(status?: CampaignStatus) {
  return prisma.campaign.findMany({
    where: status ? { status } : undefined,
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