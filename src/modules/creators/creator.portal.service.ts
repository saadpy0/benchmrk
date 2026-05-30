import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { submitContent } from '../campaigns/submission.service.js';
import { processDueTrackingJobs, trackSubmissionNow } from '../campaigns/submission-tracking.service.js';
import { runSubmissionReviewSweep } from '../admin/review-queue.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const PRODUCTION_SWEEP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
const TESTING_SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const SWEEP_INTERVAL_MS = process.env.NODE_ENV === 'production' ? PRODUCTION_SWEEP_INTERVAL_MS : TESTING_SWEEP_INTERVAL_MS;

async function getVerifiedSpendByCampaignIds(campaignIds: string[]) {
  if (campaignIds.length === 0) {
    return new Map<string, number>();
  }

  const entries = await (prisma.balanceLedgerEntry as any).findMany({
    where: {
      entryType: 'RELEASE_TO_AVAILABLE',
      reviewBatch: {
        campaignId: { in: campaignIds },
      },
    },
    include: {
      reviewBatch: {
        select: {
          campaignId: true,
        },
      },
    },
  });

  const totals = new Map<string, number>();
  for (const entry of entries) {
    const campaignId = entry.reviewBatch?.campaignId;
    if (!campaignId) continue;
    totals.set(campaignId, (totals.get(campaignId) ?? 0) + Number(entry.amount ?? 0));
  }

  return totals;
}

type CreatorAuthResult = {
  token: string;
  user: {
    id: string;
    email: string;
    role: 'CREATOR';
  };
  profile: {
    id: string;
    displayName: string;
    bio: string | null;
  };
};

function createCreatorToken(userId: string) {
  return jwt.sign({ userId, role: 'CREATOR' }, JWT_SECRET, { expiresIn: '7d' });
}

function defaultDisplayNameFromEmail(email: string) {
  return email.split('@')[0]?.replace(/[._-]+/g, ' ').trim() || 'Creator';
}

async function ensureCreatorProfile(userId: string, email: string, displayName?: string, bio?: string | null) {
  const existing = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (existing) {
    await prisma.creatorWallet.upsert({
      where: { creatorId: existing.id },
      update: {},
      create: { creatorId: existing.id },
    });
    await prisma.earningsWallet.upsert({
      where: { creatorId: existing.id },
      update: {},
      create: { creatorId: existing.id },
    });
    return existing;
  }

  const profile = await prisma.creatorProfile.create({
    data: {
      userId,
      displayName: displayName?.trim() || defaultDisplayNameFromEmail(email),
      ...(bio !== undefined ? { bio } : {}),
    },
  });

  await prisma.creatorWallet.create({ data: { creatorId: profile.id } });
  await prisma.earningsWallet.create({ data: { creatorId: profile.id } });
  return profile;
}

function formatCreatorAuthResult(user: { id: string; email: string }, profile: { id: string; displayName: string; bio: string | null }): CreatorAuthResult {
  return {
    token: createCreatorToken(user.id),
    user: {
      id: user.id,
      email: user.email,
      role: 'CREATOR',
    },
    profile: {
      id: profile.id,
      displayName: profile.displayName,
      bio: profile.bio,
    },
  };
}

async function getInstagramConnectionSummary(userId: string) {
  const account = await prisma.connectedPlatformAccount.findFirst({
    where: {
      userId,
      platform: 'INSTAGRAM',
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
  });

  if (!account) {
    return {
      connected: false,
      username: null,
      followerCount: null,
      accountType: null,
      connectedAt: null,
    };
  }

  return {
    connected: true,
    username: account.channelTitle ?? null,
    followerCount: account.subscriberCount ?? null,
    accountType: account.uploadsPlaylistId ?? null,
    connectedAt: account.updatedAt,
  };
}

export async function signupCreatorPortal(input: {
  email: string;
  password: string;
  displayName?: string;
  bio?: string;
}) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already in use');

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'CREATOR',
    },
  });

  const profile = await ensureCreatorProfile(user.id, user.email, input.displayName, input.bio ?? null);
  return formatCreatorAuthResult(user, profile);
}

export async function loginCreatorPortal(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.role !== 'CREATOR') {
    throw new Error('Invalid creator credentials');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new Error('Invalid creator credentials');
  }

  const profile = await ensureCreatorProfile(user.id, user.email);
  return formatCreatorAuthResult(user, profile);
}

export async function getCreatorPortalSession(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CREATOR') {
    throw new Error('Creator account not found');
  }

  const profile = await ensureCreatorProfile(user.id, user.email);
  return {
    ...formatCreatorAuthResult(user, profile),
    integrations: {
      instagram: await getInstagramConnectionSummary(user.id),
    },
  };
}

export async function listCreatorPortalCampaigns() {
  const now = new Date();
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: 'LIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: {
      brand: {
        select: {
          companyName: true,
        },
      },
      _count: {
        select: {
          submissions: true,
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  });
  const verifiedSpendByCampaignId = await getVerifiedSpendByCampaignIds(campaigns.map((campaign) => campaign.id));

  return campaigns.map((campaign) => {
    const sweepEligibleAt = new Date(new Date(campaign.startDate).getTime() + SWEEP_INTERVAL_MS);
    const totalBudget = Number(campaign.totalBudget);
    const spentBudget = verifiedSpendByCampaignId.get(campaign.id) ?? 0;
    return {
      id: campaign.id,
      title: campaign.title,
      description: campaign.description,
      guidelines: campaign.guidelines,
      brandName: campaign.brand.companyName,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      dollarsPerThousandViews: Number(campaign.cpvRate) * 1000,
      cpvRate: Number(campaign.cpvRate),
      totalBudget,
      spentBudget,
      remainingBudget: Math.max(totalBudget - spentBudget, 0),
      minimumPayoutViews: Number(campaign.minimumPayoutViews),
      maxPayoutPerSubmission: Number(campaign.maxPayoutPerSubmission),
      submissionCount: campaign._count.submissions,
      sweepEligibleAt,
      isSweepEligible: now.getTime() >= sweepEligibleAt.getTime(),
    };
  }).filter((campaign) => campaign.remainingBudget > 0);
}

async function ensureCreatorCanSubmitToCampaign(userId: string, campaignId: string) {
  const [user, profile, campaign] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.creatorProfile.findUnique({ where: { userId } }),
    prisma.campaign.findUnique({ where: { id: campaignId } }),
  ]);

  if (!user || user.role !== 'CREATOR') throw new Error('Creator account not found');
  const creatorProfile = profile ?? await ensureCreatorProfile(user.id, user.email);
  if (!campaign) throw new Error('Campaign not found');
  if (campaign.status !== 'LIVE') throw new Error('Campaign is not live');

  const releasedSpendByCampaignId = await getVerifiedSpendByCampaignIds([campaign.id]);
  const remainingBudget = Math.max(Number(campaign.totalBudget ?? 0) - (releasedSpendByCampaignId.get(campaign.id) ?? 0), 0);
  if (remainingBudget <= 0) throw new Error('Campaign budget is exhausted');

  await prisma.application.upsert({
    where: {
      campaignId_creatorId: {
        campaignId,
        creatorId: creatorProfile.id,
      },
    },
    update: { status: 'ACCEPTED' },
    create: {
      campaignId,
      creatorId: creatorProfile.id,
      status: 'ACCEPTED',
    },
  });

  return creatorProfile;
}

export async function submitCreatorPortalVideo(input: {
  userId: string;
  campaignId: string;
  platform: 'YOUTUBE' | 'INSTAGRAM';
  contentUrl: string;
}) {
  await ensureCreatorCanSubmitToCampaign(input.userId, input.campaignId);
  const submission = await submitContent(input.userId, input.campaignId, input.platform, input.contentUrl);
  await trackSubmissionNow(input.userId, submission.id);
  // Auto-run the review sweep so batches appear immediately without manual admin trigger
  runSubmissionReviewSweep({ campaignId: input.campaignId }).catch(() => {});
  return submission;
}

function computeSubmissionFinancials(submission: any) {
  const latestSnapshot = submission.metricSnapshots?.[0] ?? null;
  const latestViews = Number(latestSnapshot?.viewCount ?? 0);
  const cpvRate = Number(submission.campaign.cpvRate ?? 0);
  const grossCurrentValue = latestViews * cpvRate;
  const cap = Number(submission.campaign.maxPayoutPerSubmission ?? 0);
  const projectedValue = cap > 0 ? Math.min(grossCurrentValue, cap) : grossCurrentValue;
  // Use actual RELEASE_TO_AVAILABLE ledger entries so partial payouts are
  // correctly reflected (batch.grossAmount stays as the full batch size even
  // after a partial verify, which would incorrectly zero out pendingAmount).
  const releasedAmount = (submission.reviewBatches ?? []).reduce((sum: number, batch: any) => {
    if (batch.status !== 'VERIFIED') return sum;
    return sum + (batch.ledgerEntries ?? []).reduce((entrySum: number, entry: any) => {
      return entry.entryType === 'RELEASE_TO_AVAILABLE' ? entrySum + Number(entry.amount ?? 0) : entrySum;
    }, 0);
  }, 0);
  const resolvedAmount = releasedAmount;
  const pendingAmount = Math.max(projectedValue - releasedAmount, 0);

  return {
    latestViews,
    projectedValue,
    settledAmount: resolvedAmount,
    releasedAmount,
    pendingAmount,
  };
}

function formatWalletHistoryEntry(entry: any) {
  return {
    id: entry.id,
    entryType: entry.entryType,
    amount: Number(entry.amount ?? 0),
    status: entry.status,
    createdAt: entry.createdAt,
    releasedAt: entry.releasedAt,
    notes: entry.notes ?? null,
    submissionId: entry.submissionId ?? null,
    reviewBatchId: entry.reviewBatchId ?? null,
    submission: entry.submission ? {
      id: entry.submission.id,
      platform: entry.submission.platform,
      contentUrl: entry.submission.contentUrl,
      campaignTitle: entry.submission.campaign?.title ?? null,
    } : null,
  };
}

export async function getCreatorPortalDashboard(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CREATOR') throw new Error('Creator account not found');

  const creator = await ensureCreatorProfile(user.id, user.email);
  const [submissions, availableCampaigns, creatorWallet] = await Promise.all([
    prisma.contentSubmission.findMany({
      where: { creatorId: creator.id },
      include: {
        campaign: {
          select: {
            id: true,
            title: true,
            cpvRate: true,
            totalBudget: true,
            maxPayoutPerSubmission: true,
            minimumPayoutViews: true,
          },
        },
        metricSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
        reviewBatches: {
          select: {
            grossAmount: true,
            status: true,
            ledgerEntries: {
              where: {
                entryType: 'RELEASE_TO_AVAILABLE',
              },
              select: {
                entryType: true,
                amount: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    listCreatorPortalCampaigns(),
    prisma.creatorWallet.findUnique({
      where: { creatorId: creator.id },
      include: {
        entries: {
          where: {
            entryType: {
              in: ['RELEASE_TO_AVAILABLE', 'WITHDRAWAL'],
            },
          },
          include: {
            submission: {
              select: {
                id: true,
                platform: true,
                contentUrl: true,
                campaign: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    }),
  ]);

  const campaignById = new Map(availableCampaigns.map((campaign) => [campaign.id, campaign]));
  const verifiedSpendByCampaignId = await getVerifiedSpendByCampaignIds(
    Array.from(new Set(submissions.map((submission) => submission.campaignId))),
  );

  const submissionItems = submissions.map((submission) => {
    const financials = computeSubmissionFinancials(submission);
    const campaignBudget = campaignById.get(submission.campaignId);
    const totalBudget = Number(campaignBudget?.totalBudget ?? submission.campaign.totalBudget ?? 0);
    const remainingBudget = campaignBudget?.remainingBudget
      ?? Math.max(totalBudget - (verifiedSpendByCampaignId.get(submission.campaignId) ?? 0), 0);
    return {
      id: submission.id,
      campaignId: submission.campaignId,
      campaignTitle: submission.campaign.title,
      platform: submission.platform,
      contentUrl: submission.contentUrl,
      status: submission.status,
      createdAt: submission.createdAt,
      updatedAt: submission.updatedAt,
      verifiedViews: submission.verifiedViews ?? 0,
      latestViews: financials.latestViews,
      latestSnapshotAt: submission.metricSnapshots?.[0]?.capturedAt ?? null,
      totalBudget,
      remainingBudget: Number(remainingBudget),
      minimumIncrementalViewsPerSweep: Number(submission.campaign.minimumPayoutViews ?? 0),
      projectedValue: Number(financials.projectedValue.toFixed(2)),
      withdrawableAmount: Number(financials.releasedAmount.toFixed(2)),
      pendingAmount: Number(financials.pendingAmount.toFixed(2)),
    };
  });

  const totalPending = submissionItems.reduce((sum, item) => sum + item.pendingAmount, 0);
  const totalProjected = submissionItems.reduce((sum, item) => sum + item.projectedValue, 0);
  const totalLatestViews = submissionItems.reduce((sum, item) => sum + item.latestViews, 0);
  const totalVerifiedViews = submissionItems.reduce((sum, item) => sum + item.verifiedViews, 0);
  const withdrawableAmount = Number(creatorWallet?.availableBalance ?? 0);
  const lifetimeEarned = Number(creatorWallet?.lifetimeEarned ?? 0);
  const instagram = await getInstagramConnectionSummary(user.id);
  const walletHistory = (creatorWallet?.entries ?? []).map(formatWalletHistoryEntry);

  return {
    creator: {
      id: creator.id,
      displayName: creator.displayName,
      bio: creator.bio,
      email: user.email,
      kycStatus: creator.kycStatus,
      reputationScore: creator.reputationScore,
    },
    integrations: {
      instagram,
    },
    summary: {
      totalSubmissions: submissionItems.length,
      totalLatestViews,
      totalVerifiedViews,
      totalProjectedValue: Number(totalProjected.toFixed(2)),
      pendingAmount: Number(totalPending.toFixed(2)),
      withdrawableAmount: Number(withdrawableAmount.toFixed(2)),
      lifetimeEarned: Number(lifetimeEarned.toFixed(2)),
    },
    campaigns: availableCampaigns,
    submissions: submissionItems,
    walletHistory,
  };
}

export async function runCreatorPortalDueTracking(userId: string, maxJobs = 10) {
  return processDueTrackingJobs({ userId, maxJobs });
}
