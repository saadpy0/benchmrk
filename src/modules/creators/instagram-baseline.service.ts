import { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rebuildCreatorBaseline, recalculateReputationScore } from './baseline.service.js';

type InstagramMediaResponse = {
  data?: Array<{
    id: string;
    media_type?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
    media_product_type?: string;
  }>;
};

type InstagramInsightResponse = {
  data?: Array<{
    name?: string;
    values?: Array<{
      value?: number;
    }>;
  }>;
};

function getGraphBaseUrl() {
  return process.env.INSTAGRAM_GRAPH_BASE_URL ?? 'https://graph.instagram.com/v24.0';
}

function normalizeNonNegativeInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

async function instagramGet<T>(path: string, params: Record<string, string>) {
  const accessToken = params.access_token;
  if (!accessToken) {
    throw new Error('Instagram connected account access token is missing');
  }

  const url = new URL(`${getGraphBaseUrl()}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : 'Instagram API request failed';
    throw new Error(message);
  }

  return data as T;
}

async function fetchMediaViewLikeMetric(accessToken: string, mediaId: string) {
  const candidates = ['views', 'plays', 'reach', 'impressions'];

  for (const metric of candidates) {
    try {
      const response = await instagramGet<InstagramInsightResponse>(`/${mediaId}/insights`, {
        metric,
        access_token: accessToken,
      });
      const value = response.data?.[0]?.values?.[0]?.value;
      const normalized = normalizeNonNegativeInt(value);
      if (normalized > 0) {
        return normalized;
      }
    } catch {
    }
  }

  return 0;
}

function resolveInstagramAccountAgeDays(postTimestamps: Array<string | null>) {
  const timestamps = postTimestamps
    .filter((value): value is string => typeof value === 'string')
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return 30;
  }

  return Math.max(0, Math.floor((Date.now() - Math.min(...timestamps)) / (1000 * 60 * 60 * 24)));
}

export async function rebuildInstagramBaselineFromConnectedAccount(input: {
  userId: string;
  maxResults?: number;
}) {
  const connectedAccount = await prisma.connectedPlatformAccount.findFirst({
    where: {
      userId: input.userId,
      platform: Platform.INSTAGRAM,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  if (!connectedAccount) {
    throw new Error('No connected Instagram account found');
  }

  if (!connectedAccount.accessToken) {
    throw new Error('Connected Instagram account token is missing');
  }

  const maxResults = Math.min(Math.max(input.maxResults ?? 10, 1), 30);
  const mediaResponse = await instagramGet<InstagramMediaResponse>('/me/media', {
    fields: 'id,media_type,timestamp,like_count,comments_count,media_product_type',
    limit: String(maxResults),
    access_token: connectedAccount.accessToken,
  });

  const media = mediaResponse.data ?? [];

  const posts = await Promise.all(
    media.map(async (item) => {
      const insightViews = await fetchMediaViewLikeMetric(connectedAccount.accessToken as string, item.id);
      const likes = normalizeNonNegativeInt(item.like_count);
      const comments = normalizeNonNegativeInt(item.comments_count);
      const views = insightViews > 0 ? insightViews : Math.max(likes + comments, 1);

      return {
        views,
        likes,
        comments,
        timestamp: item.timestamp ?? null,
      };
    }),
  );

  const accountAgeDays = resolveInstagramAccountAgeDays(posts.map((post) => post.timestamp));
  const followerCount = connectedAccount.subscriberCount ?? undefined;

  const result = await rebuildCreatorBaseline({
    userId: input.userId,
    platform: Platform.INSTAGRAM,
    accountAgeDays,
    ...(followerCount !== undefined ? { followerCount } : {}),
    posts: posts.map((post) => ({
      views: post.views,
      likes: post.likes,
      comments: post.comments,
    })),
  });

  await prisma.connectedPlatformAccount.update({
    where: { id: connectedAccount.id },
    data: {
      trustScore: result.trustScore,
      baselineAvgViews: result.baseline.avgViews,
      baselineEngagement: result.baseline.avgEngagementRate,
      baselineFollowerCount: result.baseline.followerCount ?? null,
    },
  });

  return {
    ...result,
    source: {
      platform: 'INSTAGRAM',
      sourceType: 'CONNECTED_ACCOUNT',
      accountId: connectedAccount.providerAccountId,
      username: connectedAccount.channelTitle,
      accountType: connectedAccount.uploadsPlaylistId,
      accountAgeDays,
      followerCount: followerCount ?? null,
      mediaFetched: posts.length,
    },
  };
}

export async function rebuildInstagramAccountTrustScore(input: {
  userId: string;
  accountId: string;
}) {
  const connectedAccount = await prisma.connectedPlatformAccount.findFirst({
    where: { id: input.accountId, userId: input.userId, platform: Platform.INSTAGRAM },
  });

  if (!connectedAccount) throw new Error('Connected Instagram account not found');
  if (!connectedAccount.accessToken) throw new Error('Connected Instagram account token is missing');

  const maxResults = 10;
  const mediaResponse = await instagramGet<InstagramMediaResponse>('/me/media', {
    fields: 'id,media_type,timestamp,like_count,comments_count,media_product_type',
    limit: String(maxResults),
    access_token: connectedAccount.accessToken,
  });

  const media = mediaResponse.data ?? [];

  const posts = await Promise.all(
    media.map(async (item) => {
      const insightViews = await fetchMediaViewLikeMetric(connectedAccount.accessToken as string, item.id);
      const likes = normalizeNonNegativeInt(item.like_count);
      const comments = normalizeNonNegativeInt(item.comments_count);
      const views = insightViews > 0 ? insightViews : Math.max(likes + comments, 1);
      return { views, likes, comments, timestamp: item.timestamp ?? null };
    }),
  );

  const accountAgeDays = resolveInstagramAccountAgeDays(posts.map((post) => post.timestamp));
  const followerCount = connectedAccount.subscriberCount ?? undefined;

  const result = await rebuildCreatorBaseline({
    userId: input.userId,
    platform: Platform.INSTAGRAM,
    accountAgeDays,
    ...(followerCount !== undefined ? { followerCount } : {}),
    posts: posts.map((post) => ({ views: post.views, likes: post.likes, comments: post.comments })),
  });

  await prisma.connectedPlatformAccount.update({
    where: { id: connectedAccount.id },
    data: {
      trustScore: result.trustScore,
      baselineAvgViews: result.baseline.avgViews,
      baselineEngagement: result.baseline.avgEngagementRate,
      baselineFollowerCount: result.baseline.followerCount ?? null,
    },
  });

  await recalculateReputationScore(input.userId);

  return { ...result, accountId: connectedAccount.id };
}
