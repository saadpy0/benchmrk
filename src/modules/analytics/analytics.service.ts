import { prisma } from '../../lib/prisma.js';

export async function getPlatformAnalytics() {
  const [
    totalUsers,
    totalCreators,
    totalBrands,
    totalCampaigns,
    totalSubmissions,
    totalApplications,
    totalPayouts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'CREATOR' } }),
    prisma.user.count({ where: { role: 'BRAND' } }),
    prisma.campaign.count(),
    prisma.contentSubmission.count(),
    prisma.application.count(),
    prisma.payout.count({ where: { status: 'COMPLETED' } }),
  ]);

  const campaignsByStatus = await prisma.campaign.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const submissionsByStatus = await prisma.contentSubmission.groupBy({
    by: ['status'],
    _count: { status: true },
  });

  const submissionsByPlatform = await prisma.contentSubmission.groupBy({
    by: ['platform'],
    _count: { platform: true },
  });

  const totalVerifiedViews = await prisma.contentSubmission.aggregate({
    _sum: { verifiedViews: true },
  });

  const totalPayoutAmount = await prisma.payout.aggregate({
    where: { status: 'COMPLETED' },
    _sum: { amount: true },
  });

  return {
    users: {
      total: totalUsers,
      creators: totalCreators,
      brands: totalBrands,
    },
    campaigns: {
      total: totalCampaigns,
      byStatus: campaignsByStatus,
    },
    submissions: {
      total: totalSubmissions,
      byStatus: submissionsByStatus,
      byPlatform: submissionsByPlatform,
    },
    applications: {
      total: totalApplications,
    },
    payouts: {
      totalCompleted: totalPayouts,
      totalAmountPaid: totalPayoutAmount._sum.amount ?? 0,
    },
    views: {
      totalVerified: totalVerifiedViews._sum.verifiedViews ?? 0,
    },
  };
}

export async function getBrandAnalytics(userId: string) {
  const brand = await prisma.brandProfile.findUnique({ where: { userId } });
  if (!brand) throw new Error('Brand profile not found');

  const campaigns = await prisma.campaign.findMany({
    where: { brandId: brand.id },
    include: {
      _count: {
        select: { applications: true, submissions: true },
      },
      submissions: {
        select: { verifiedViews: true, status: true, platform: true },
      },
    },
  });

  const totalSpent = await prisma.payout.aggregate({
    where: {
      wallet: {
        creator: {
          submissions: {
            some: { campaign: { brandId: brand.id } },
          },
        },
      },
      status: 'COMPLETED',
    },
    _sum: { amount: true },
  });

  const totalVerifiedViews = campaigns.reduce((acc, c) => {
    return acc + c.submissions.reduce((s, sub) => s + (sub.verifiedViews ?? 0), 0);
  }, 0);

  return {
    totalCampaigns: campaigns.length,
    totalVerifiedViews,
    totalSpent: totalSpent._sum.amount ?? 0,
    campaigns: campaigns.map(c => ({
      id: c.id,
      title: c.title,
      status: c.status,
      cpvRate: c.cpvRate,
      totalBudget: c.totalBudget,
      applications: c._count.applications,
      submissions: c._count.submissions,
      verifiedViews: c.submissions.reduce((s, sub) => s + (sub.verifiedViews ?? 0), 0),
    })),
  };
}

export async function getCreatorAnalytics(userId: string) {
  const creator = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creator) throw new Error('Creator profile not found');

  const submissions = await prisma.contentSubmission.findMany({
    where: { creatorId: creator.id },
    include: { campaign: { select: { title: true, cpvRate: true } } },
  });

  const wallet = await prisma.earningsWallet.findUnique({
    where: { creatorId: creator.id },
  });

  const totalVerifiedViews = submissions.reduce((acc, s) => acc + (s.verifiedViews ?? 0), 0);

  const submissionsByStatus = submissions.reduce((acc: Record<string, number>, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    totalSubmissions: submissions.length,
    totalVerifiedViews,
    submissionsByStatus,
    balance: wallet?.balance ?? 0,
    totalEarned: wallet?.totalEarned ?? 0,
    kycStatus: creator.kycStatus,
    reputationScore: creator.reputationScore,
    submissions: submissions.map(s => ({
      id: s.id,
      campaignTitle: s.campaign.title,
      platform: s.platform,
      status: s.status,
      verifiedViews: s.verifiedViews ?? 0,
      estimatedEarnings: (s.verifiedViews ?? 0) * parseFloat(s.campaign.cpvRate.toString()),
    })),
  };
}