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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function coefficientOfVariation(values: number[]) {
  const avg = average(values);
  if (avg === 0) return 0;

  const variance = average(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance) / avg;
}

function normalizeLinear(value: number, min: number, max: number) {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function normalizeLogRange(value: number, min: number, max: number) {
  const safeValue = Math.max(value, 0);
  const logValue = Math.log10(safeValue + 1);
  const logMin = Math.log10(Math.max(min, 0) + 1);
  const logMax = Math.log10(Math.max(max, 0) + 1);

  return normalizeLinear(logValue, logMin, logMax);
}

function calculateConsistencyScore(posts: HistoricalPostSample[]) {
  if (posts.length === 0) return 0;

  const logViews = posts.map((post) => Math.log1p(post.views));
  const engagementRates = posts.map((post) => (post.likes + post.comments) / Math.max(post.views, 1));

  const viewConsistency = 1 - clamp(coefficientOfVariation(logViews) / 0.6, 0, 1);
  const engagementConsistency = 1 - clamp(coefficientOfVariation(engagementRates) / 1.25, 0, 1);

  return Number((viewConsistency * 0.65 + engagementConsistency * 0.35).toFixed(4));
}

function calculateTrustScore({
  accountAgeDays,
  sampleSize,
  avgViews,
  avgEngagementRate,
  consistencyScore,
  followerCount,
  audienceIndiaPct,
}: {
  accountAgeDays: number;
  sampleSize: number;
  avgViews: number;
  avgEngagementRate: number;
  consistencyScore: number;
  followerCount?: number | undefined;
  audienceIndiaPct?: number | undefined;
}) {
  const accountMaturityScore = Math.min(accountAgeDays / 365, 1) * 18;
  const sampleReliabilityScore = Math.min(sampleSize / 30, 1) * 6;
  const followerAuthorityNormalized = followerCount === undefined ? 0 : normalizeLogRange(followerCount, 1_000, 100_000_000);
  const viewFloorNormalized = normalizeLogRange(avgViews, 1_000, 50_000_000);
  const followerAuthorityScore = followerAuthorityNormalized * 20;
  const viewFloorScore = viewFloorNormalized * 20;
  const expectedEngagementRate =
    followerCount === undefined
      ? 0.02
      : followerCount >= 10_000_000
        ? 0.01
        : followerCount >= 1_000_000
          ? 0.015
          : followerCount >= 100_000
            ? 0.02
            : 0.03;
  const engagementQualityScore = clamp(avgEngagementRate / expectedEngagementRate, 0, 1) * 8;
  const audienceConversionNormalized =
    followerCount === undefined || followerCount <= 0 ? normalizeLogRange(avgViews, 5_000, 5_000_000) : clamp(avgViews / followerCount / 0.12, 0, 1);
  const audienceConversionScore = audienceConversionNormalized * 10;
  const consistencyWeightedScore = consistencyScore * 10;
  const maturityNormalized = Math.min(accountAgeDays / 365, 1);
  const establishedAuthorityScore = maturityNormalized * (followerAuthorityNormalized * 0.55 + viewFloorNormalized * 0.45) * 14;
  const freshnessNormalized = 1 - maturityNormalized;
  const emergingTractionScore = freshnessNormalized * Math.max(followerAuthorityNormalized, viewFloorNormalized, audienceConversionNormalized) * 12;
  const audienceFitScore = audienceIndiaPct === undefined ? 0 : Math.min(audienceIndiaPct / 80, 1) * 4;

  const trustScore = Number(
    Math.min(
      100,
      accountMaturityScore +
        sampleReliabilityScore +
        followerAuthorityScore +
        viewFloorScore +
        engagementQualityScore +
        audienceConversionScore +
        consistencyWeightedScore +
        establishedAuthorityScore +
        emergingTractionScore +
        audienceFitScore,
    ).toFixed(2),
  );

  const trustTier = trustScore >= 90 ? 'HIGH_CONFIDENCE' : trustScore >= 75 ? 'TRUSTED' : trustScore >= 55 ? 'WATCHLIST' : 'UNTRUSTED';

  return {
    trustScore,
    trustTier,
    breakdown: {
      accountMaturityScore: Number(accountMaturityScore.toFixed(2)),
      sampleReliabilityScore: Number(sampleReliabilityScore.toFixed(2)),
      followerAuthorityScore: Number(followerAuthorityScore.toFixed(2)),
      viewFloorScore: Number(viewFloorScore.toFixed(2)),
      engagementQualityScore: Number(engagementQualityScore.toFixed(2)),
      audienceConversionScore: Number(audienceConversionScore.toFixed(2)),
      consistencyScore: Number(consistencyWeightedScore.toFixed(2)),
      establishedAuthorityScore: Number(establishedAuthorityScore.toFixed(2)),
      emergingTractionScore: Number(emergingTractionScore.toFixed(2)),
      audienceFitScore: Number(audienceFitScore.toFixed(2)),
    },
  };
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
  const trustResult = calculateTrustScore({
    accountAgeDays: input.accountAgeDays,
    sampleSize,
    avgViews,
    avgEngagementRate,
    consistencyScore,
    ...(input.followerCount !== undefined ? { followerCount: input.followerCount } : {}),
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
      followerCount: input.followerCount ?? null,
      audienceIndiaPct: input.audienceIndiaPct ?? null,
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
      followerCount: input.followerCount ?? null,
      audienceIndiaPct: input.audienceIndiaPct ?? null,
    },
  });

  await prisma.creatorProfile.update({
    where: { id: creatorProfile.id },
    data: { reputationScore: trustResult.trustScore },
  });

  return {
    baseline,
    trustScore: trustResult.trustScore,
    trustTier: trustResult.trustTier,
    consistencyScore,
    scoreBreakdown: trustResult.breakdown,
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
