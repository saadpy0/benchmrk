import type { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type HistoricalPostSample = {
  views: number;
  likes: number;
  comments: number;
};

type RebuildCreatorBaselineInput = {
  userId: string;
  platform: Platform;
  accountAgeDays: number;
  followerCount?: number | undefined;
  audienceIndiaPct?: number | undefined;
  posts: HistoricalPostSample[];
};

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function calculateConsistencyScore(posts: HistoricalPostSample[]) {
  const avgViews = average(posts.map((post) => post.views));
  if (avgViews === 0) return 0;

  const variance = average(posts.map((post) => (post.views - avgViews) ** 2));
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = standardDeviation / avgViews;

  return Math.max(0, 1 - Math.min(coefficientOfVariation, 1));
}

function calculateTrustScore({
  accountAgeDays,
  avgEngagementRate,
  consistencyScore,
  audienceIndiaPct,
}: {
  accountAgeDays: number;
  avgEngagementRate: number;
  consistencyScore: number;
  audienceIndiaPct?: number | undefined;
}) {
  const accountAgeScore = Math.min(accountAgeDays / 365, 1) * 35;
  const engagementScore = Math.min(avgEngagementRate / 0.05, 1) * 35;
  const consistencyWeightedScore = consistencyScore * 20;
  const audienceScore = audienceIndiaPct === undefined ? 0 : Math.min(audienceIndiaPct / 80, 1) * 10;

  return Number((accountAgeScore + engagementScore + consistencyWeightedScore + audienceScore).toFixed(2));
}

export async function rebuildCreatorBaseline(input: RebuildCreatorBaselineInput) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId: input.userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

  const sampleSize = input.posts.length;
  const avgViews = average(input.posts.map((post) => post.views));
  const avgLikes = average(input.posts.map((post) => post.likes));
  const avgComments = average(input.posts.map((post) => post.comments));
  const avgEngagementRate = avgViews === 0 ? 0 : (avgLikes + avgComments) / avgViews;
  const consistencyScore = calculateConsistencyScore(input.posts);
  const trustScore = calculateTrustScore({
    accountAgeDays: input.accountAgeDays,
    avgEngagementRate,
    consistencyScore,
    ...(input.audienceIndiaPct !== undefined ? { audienceIndiaPct: input.audienceIndiaPct } : {}),
  });

  const baseline = await prisma.creatorBaseline.upsert({
    where: {
      creatorId_platform: {
        creatorId: creatorProfile.id,
        platform: input.platform,
      },
    },
    update: {
      sampleSize,
      avgViews,
      avgLikes,
      avgComments,
      avgEngagementRate,
      ...(input.followerCount !== undefined ? { followerCount: input.followerCount } : {}),
      ...(input.audienceIndiaPct !== undefined ? { audienceIndiaPct: input.audienceIndiaPct } : {}),
      computedAt: new Date(),
    },
    create: {
      creatorId: creatorProfile.id,
      platform: input.platform,
      sampleSize,
      avgViews,
      avgLikes,
      avgComments,
      avgEngagementRate,
      ...(input.followerCount !== undefined ? { followerCount: input.followerCount } : {}),
      ...(input.audienceIndiaPct !== undefined ? { audienceIndiaPct: input.audienceIndiaPct } : {}),
    },
  });

  await prisma.creatorProfile.update({
    where: { id: creatorProfile.id },
    data: { reputationScore: trustScore },
  });

  return {
    baseline,
    trustScore,
    consistencyScore: Number(consistencyScore.toFixed(4)),
  };
}

export async function getCreatorBaseline(userId: string, platform: Platform) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) throw new Error('Creator profile not found');

  const baseline = await prisma.creatorBaseline.findUnique({
    where: {
      creatorId_platform: {
        creatorId: creatorProfile.id,
        platform,
      },
    },
  });

  if (!baseline) throw new Error('Creator baseline not found');

  return baseline;
}
