import { prisma } from '../../lib/prisma.js';
import { CampaignStatus } from '@prisma/client';
import { canTransition } from '../campaigns/campaign.state.js';

export async function getAllUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      createdAt: true,
      creatorProfile: { select: { displayName: true, kycStatus: true, reputationScore: true } },
      brandProfile: { select: { companyName: true, verified: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPendingCampaigns() {
  return prisma.campaign.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: { brand: { select: { companyName: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

export async function approveCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (!canTransition(campaign.status, 'LIVE')) {
    throw new Error(`Cannot approve campaign in status ${campaign.status}`);
  }
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'LIVE' },
  });
}

export async function rejectCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');
  if (!canTransition(campaign.status, 'REJECTED')) {
    throw new Error(`Cannot reject campaign in status ${campaign.status}`);
  }
  return prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'REJECTED' },
  });
}

export async function suspendUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.role === 'ADMIN') throw new Error('Cannot suspend an admin');
  return prisma.user.delete({ where: { id: userId } });
}

export async function getPlatformStats() {
  const [totalUsers, totalCampaigns, totalSubmissions, totalApplications] = await Promise.all([
    prisma.user.count(),
    prisma.campaign.count(),
    prisma.contentSubmission.count(),
    prisma.application.count(),
  ]);

  const campaignsByStatus = await prisma.campaign.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  return {
    totalUsers,
    totalCampaigns,
    totalSubmissions,
    totalApplications,
    campaignsByStatus,
  };
}

export async function updateApplicationStatus(applicationId: string, status: 'ACCEPTED' | 'REJECTED') {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new Error('Application not found');
  return prisma.application.update({
    where: { id: applicationId },
    data: { status },
  });
}