import { Decimal } from '@prisma/client/runtime/library.js';
import { prisma } from '../../lib/prisma.js';
import { getSubmissionTrackingForAdmin } from '../campaigns/submission-tracking.service.js';

const PRODUCTION_SWEEP_INTERVAL_DAYS = 7;
const TESTING_SWEEP_INTERVAL_MINUTES = 10;
const SWEEP_INTERVAL_MS = process.env.NODE_ENV === 'production'
  ? PRODUCTION_SWEEP_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  : TESTING_SWEEP_INTERVAL_MINUTES * 60 * 1000;
const ReviewBatchStatus = {
  PENDING_REVIEW: 'PENDING_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  MORE_INFO_REQUESTED: 'MORE_INFO_REQUESTED',
} as const;

type ReviewBatchAction = 'VERIFY' | 'REJECT' | 'REQUEST_MORE_INFO';

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

function getCurrentSweepNumber(campaignStartDate: Date, now: Date) {
  const elapsed = now.getTime() - campaignStartDate.getTime();
  if (elapsed < SWEEP_INTERVAL_MS) {
    return 0;
  }
  return Math.floor(elapsed / SWEEP_INTERVAL_MS);
}

function getSweepOpenedAt(campaignStartDate: Date, cycleNumber: number) {
  return new Date(campaignStartDate.getTime() + cycleNumber * SWEEP_INTERVAL_MS);
}

async function ensureCreatorWallet(tx: any, creatorId: string) {
  return tx.creatorWallet.upsert({
    where: { creatorId },
    update: {},
    create: { creatorId },
  });
}

async function getPendingLedgerEntryForBatch(tx: any, reviewBatchId: string) {
  return (tx.balanceLedgerEntry as any).findFirst({
    where: {
      reviewBatchId,
      entryType: 'ACCRUAL_PENDING',
    },
    orderBy: [{ createdAt: 'desc' }],
  });
}

async function getLatestSnapshot(submissionId: string) {
  return (prisma.metricSnapshot as any).findFirst({
    where: { submissionId },
    orderBy: { capturedAt: 'desc' },
  });
}

async function getLatestReviewBatch(submissionId: string) {
  return ((prisma as any).submissionReviewBatch).findFirst({
    where: { submissionId },
    orderBy: [{ cycleNumber: 'desc' }, { createdAt: 'desc' }],
  });
}

async function getLockedAmountSoFar(submissionId: string) {
  const aggregate = await ((prisma as any).submissionReviewBatch).aggregate({
    where: {
      submissionId,
      status: {
        in: [ReviewBatchStatus.PENDING_REVIEW, ReviewBatchStatus.VERIFIED, ReviewBatchStatus.MORE_INFO_REQUESTED],
      },
    },
    _sum: {
      grossAmount: true,
    },
  });

  return Number(aggregate?._sum?.grossAmount ?? 0);
}

export async function runSubmissionReviewSweep(input?: { campaignId?: string }) {
  const now = new Date();
  const campaigns = await (prisma.campaign as any).findMany({
    where: {
      status: 'LIVE',
      ...(input?.campaignId ? { id: input.campaignId } : {}),
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { startDate: 'asc' },
  });

  const results: Array<{
    campaignId: string;
    cycleNumber: number;
    createdBatchIds: string[];
    skippedSubmissionIds: string[];
  }> = [];

  for (const campaign of campaigns) {
    const cycleNumber = getCurrentSweepNumber(new Date(campaign.startDate), now);
    if (cycleNumber <= 0) {
      results.push({ campaignId: campaign.id, cycleNumber, createdBatchIds: [], skippedSubmissionIds: [] });
      continue;
    }

    const submissions = await (prisma.contentSubmission as any).findMany({
      where: {
        campaignId: campaign.id,
      },
      include: {
        metricSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const createdBatchIds: string[] = [];
    const skippedSubmissionIds: string[] = [];

    for (const submission of submissions) {
      const existingBatch = await ((prisma as any).submissionReviewBatch).findUnique({
        where: {
          submissionId_cycleNumber: {
            submissionId: submission.id,
            cycleNumber,
          },
        },
      }).catch(() => null);
      if (existingBatch) {
        skippedSubmissionIds.push(submission.id);
        continue;
      }

      const latestSnapshot = submission.metricSnapshots?.[0] ?? await getLatestSnapshot(submission.id);
      const latestViews = latestSnapshot ? toNumber(latestSnapshot.viewCount) : 0;

      const latestBatch = await getLatestReviewBatch(submission.id);
      const lockedFromViews = latestBatch ? toNumber(latestBatch.lockedToViews) : 0;
      const incrementalViews = Math.max(latestViews - lockedFromViews, 0);
      if (incrementalViews < toNumber(campaign.minimumPayoutViews)) {
        skippedSubmissionIds.push(submission.id);
        continue;
      }
      if (incrementalViews <= 0) {
        skippedSubmissionIds.push(submission.id);
        continue;
      }

      const alreadyLockedAmount = await getLockedAmountSoFar(submission.id);
      const maxPayoutPerSubmission = toNumber(campaign.maxPayoutPerSubmission);
      if (maxPayoutPerSubmission > 0 && alreadyLockedAmount >= maxPayoutPerSubmission) {
        skippedSubmissionIds.push(submission.id);
        continue;
      }

      const uncappedAmount = incrementalViews * toNumber(campaign.cpvRate);
      const remainingCapAmount = maxPayoutPerSubmission > 0 ? Math.max(maxPayoutPerSubmission - alreadyLockedAmount, 0) : uncappedAmount;
      const grossAmount = maxPayoutPerSubmission > 0 ? Math.min(uncappedAmount, remainingCapAmount) : uncappedAmount;
      if (grossAmount <= 0) {
        skippedSubmissionIds.push(submission.id);
        continue;
      }

      const batch = await prisma.$transaction(async (tx) => {
        const createdBatch = await ((tx as any).submissionReviewBatch).create({
          data: {
            submissionId: submission.id,
            campaignId: campaign.id,
            cycleNumber,
            windowOpenedAt: getSweepOpenedAt(new Date(campaign.startDate), cycleNumber),
            lockedFromViews,
            lockedToViews: latestViews,
            incrementalViews,
            grossAmount: new Decimal(grossAmount),
            status: ReviewBatchStatus.PENDING_REVIEW,
          },
        });

        const wallet = await ensureCreatorWallet(tx, submission.creatorId);
        await tx.creatorWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { increment: createdBatch.grossAmount },
          },
        });

        await (tx.balanceLedgerEntry as any).create({
          data: {
            walletId: wallet.id,
            submissionId: submission.id,
            reviewBatchId: createdBatch.id,
            entryType: 'ACCRUAL_PENDING',
            status: 'PENDING',
            amount: createdBatch.grossAmount,
            notes: 'Pending earnings created for submission review batch',
          },
        });

        return createdBatch;
      });
      createdBatchIds.push(batch.id);
    }

    results.push({
      campaignId: campaign.id,
      cycleNumber,
      createdBatchIds,
      skippedSubmissionIds,
    });
  }

  return {
    processedCampaigns: results.length,
    createdBatchCount: results.reduce((sum, item) => sum + item.createdBatchIds.length, 0),
    results,
  };
}

export async function getSubmissionReviewQueue(input?: {
  campaignId?: string;
  status?: 'PENDING_REVIEW' | 'MORE_INFO_REQUESTED' | 'VERIFIED' | 'REJECTED';
}) {
  const batches = await ((prisma as any).submissionReviewBatch).findMany({
    where: {
      ...(input?.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input?.status ? { status: input.status } : {}),
    },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          minimumPayoutViews: true,
          maxPayoutPerSubmission: true,
          cpvRate: true,
        },
      },
      submission: {
        select: {
          id: true,
          contentUrl: true,
          platform: true,
          creator: {
            select: {
              id: true,
              displayName: true,
              userId: true,
            },
          },
        },
      },
    },
    orderBy: [{ campaignId: 'asc' }, { createdAt: 'desc' }],
  });

  const enriched = await Promise.all(
    batches.map(async (batch: any) => {
      const tracking = await getSubmissionTrackingForAdmin(batch.submissionId);
      return {
        batch,
        tracking,
      };
    }),
  );

  return enriched.filter(({ batch }: any) => {
    const threshold = toNumber(batch?.campaign?.minimumPayoutViews);
    return toNumber(batch?.incrementalViews) >= threshold;
  });
}

export async function getSubmissionReviewBatchDetails(batchId: string) {
  const batch = await ((prisma as any).submissionReviewBatch).findUnique({
    where: { id: batchId },
    include: {
      campaign: true,
      submission: {
        include: {
          creator: true,
        },
      },
    },
  });

  if (!batch) {
    throw new Error('Review batch not found');
  }

  const tracking = await getSubmissionTrackingForAdmin(batch.submissionId);
  return { batch, tracking };
}

export async function updateSubmissionReviewBatch(input: {
  batchId: string;
  action: ReviewBatchAction;
  note?: string;
}) {
  const batch = await ((prisma as any).submissionReviewBatch).findUnique({
    where: { id: input.batchId },
    include: {
      submission: true,
    },
  });

  if (!batch) {
    throw new Error('Review batch not found');
  }

  if (input.action === 'VERIFY') {
    return prisma.$transaction(async (tx) => {
      const wallet = await ensureCreatorWallet(tx, batch.submission.creatorId);
      const pendingEntry = await getPendingLedgerEntryForBatch(tx, batch.id);
      if (pendingEntry?.status === 'PENDING') {
        await tx.creatorWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalance: { decrement: pendingEntry.amount },
          },
        });

        await (tx.balanceLedgerEntry as any).update({
          where: { id: pendingEntry.id },
          data: {
            status: 'RELEASED',
            releasedAt: new Date(),
            notes: input.note ?? 'Pending review batch earnings released to available balance',
          },
        });
      }

      await tx.creatorWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { increment: batch.grossAmount },
          lifetimeEarned: { increment: batch.grossAmount },
        },
      });

      await (tx.balanceLedgerEntry as any).create({
        data: {
          walletId: wallet.id,
          submissionId: batch.submissionId,
          reviewBatchId: batch.id,
          entryType: 'RELEASE_TO_AVAILABLE',
          status: 'AVAILABLE',
          amount: batch.grossAmount,
          releasedAt: new Date(),
          notes: input.note ?? 'Submission review batch verified by admin',
        },
      });

      await (tx.contentSubmission as any).update({
        where: { id: batch.submissionId },
        data: {
          verifiedViews: (batch.submission.verifiedViews ?? 0) + batch.incrementalViews,
          lastCheckedAt: new Date(),
        },
      });

      return (tx as any).submissionReviewBatch.update({
        where: { id: batch.id },
        data: {
          status: ReviewBatchStatus.VERIFIED,
          adminNotes: input.note ?? null,
          moreInfoRequest: null,
          resolvedAt: new Date(),
        },
      });
    });
  }

  if (input.action === 'REQUEST_MORE_INFO') {
    return ((prisma as any).submissionReviewBatch).update({
      where: { id: batch.id },
      data: {
        status: ReviewBatchStatus.MORE_INFO_REQUESTED,
        adminNotes: input.note ?? null,
        moreInfoRequest: input.note ?? 'Admin requested more information from the creator.',
        resolvedAt: null,
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureCreatorWallet(tx, batch.submission.creatorId);
    const pendingEntry = await getPendingLedgerEntryForBatch(tx, batch.id);
    if (pendingEntry?.status === 'PENDING') {
      await tx.creatorWallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { decrement: pendingEntry.amount },
        },
      });

      await (tx.balanceLedgerEntry as any).update({
        where: { id: pendingEntry.id },
        data: {
          status: 'CANCELLED',
          releasedAt: new Date(),
          notes: input.note ?? 'Pending review batch earnings cancelled after rejection',
        },
      });
    }

    return ((tx as any).submissionReviewBatch).update({
      where: { id: batch.id },
      data: {
        status: ReviewBatchStatus.REJECTED,
        adminNotes: input.note ?? null,
        resolvedAt: new Date(),
      },
    });
  });
}
