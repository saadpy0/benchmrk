import { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { rebuildCreatorBaseline, recalculateReputationScore } from './baseline.service.js';

type YouTubeChannelResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      publishedAt?: string;
    };
    statistics?: {
      subscriberCount?: string;
    };
    contentDetails?: {
      relatedPlaylists?: {
        uploads?: string;
      };
    };
  }>;
};

type YouTubePlaylistItemsResponse = {
  items?: Array<{
    contentDetails?: {
      videoId?: string;
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id: string;
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
};

function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is required to fetch live YouTube data');
  }

  return apiKey;
}

function parseChannelInput(channelInput: string) {
  const value = channelInput.trim();

  const channelUrlMatch = value.match(/youtube\.com\/channel\/([A-Za-z0-9_-]+)/i);
  if (channelUrlMatch?.[1]) {
    return { type: 'channelId' as const, value: channelUrlMatch[1] };
  }

  const handleUrlMatch = value.match(/youtube\.com\/@([A-Za-z0-9._-]+)/i);
  if (handleUrlMatch?.[1]) {
    return { type: 'handle' as const, value: handleUrlMatch[1] };
  }

  const handleMatch = value.match(/^@([A-Za-z0-9._-]+)$/);
  if (handleMatch?.[1]) {
    return { type: 'handle' as const, value: handleMatch[1] };
  }

  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) {
    return { type: 'channelId' as const, value };
  }

  return { type: 'search' as const, value };
}

async function youtubeGet<T>(path: string, params: Record<string, string>) {
  const apiKey = getYouTubeApiKey();
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set('key', apiKey);

  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : 'YouTube API request failed';
    throw new Error(message);
  }

  return data as T;
}

async function resolveChannelId(channelInput: string) {
  const parsed = parseChannelInput(channelInput);

  if (parsed.type === 'channelId') {
    return parsed.value;
  }

  if (parsed.type === 'handle') {
    const response = await youtubeGet<YouTubeChannelResponse>('channels', {
      part: 'id',
      forHandle: parsed.value,
      maxResults: '1',
    });

    const channelId = response.items?.[0]?.id;
    if (!channelId) throw new Error('YouTube channel not found');
    return channelId;
  }

  const response = await youtubeGet<{ items?: Array<{ id?: { channelId?: string } }> }>('search', {
    part: 'snippet',
    q: parsed.value,
    type: 'channel',
    maxResults: '1',
  });

  const channelId = response.items?.[0]?.id?.channelId;
  if (!channelId) throw new Error('YouTube channel not found');
  return channelId;
}

function toNonNegativeInt(value?: string) {
  const parsed = Number(value ?? '0');
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

async function buildYoutubeBaselineFromResolvedChannel(input: {
  userId: string;
  channelId: string;
  maxResults?: number;
  sourceType: 'PUBLIC_LOOKUP' | 'CONNECTED_ACCOUNT';
}) {
  const maxResults = Math.min(Math.max(input.maxResults ?? 10, 1), 30);

  const channelResponse = await youtubeGet<YouTubeChannelResponse>('channels', {
    part: 'snippet,statistics,contentDetails',
    id: input.channelId,
  });

  const channel = channelResponse.items?.[0];
  if (!channel) throw new Error('YouTube channel not found');

  const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error('Uploads playlist not found for YouTube channel');

  const playlistItems = await youtubeGet<YouTubePlaylistItemsResponse>('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(maxResults),
  });

  const videoIds = (playlistItems.items ?? [])
    .map((item) => item.contentDetails?.videoId)
    .filter((value): value is string => Boolean(value));

  if (videoIds.length === 0) {
    throw new Error('No uploaded YouTube videos found for this channel');
  }

  const videosResponse = await youtubeGet<YouTubeVideosResponse>('videos', {
    part: 'statistics',
    id: videoIds.join(','),
    maxResults: String(videoIds.length),
  });

  const posts = (videosResponse.items ?? []).map((video) => ({
    views: toNonNegativeInt(video.statistics?.viewCount),
    likes: toNonNegativeInt(video.statistics?.likeCount),
    comments: toNonNegativeInt(video.statistics?.commentCount),
  }));

  const channelPublishedAt = channel.snippet?.publishedAt;
  if (!channelPublishedAt) {
    throw new Error('YouTube channel creation date is unavailable');
  }

  const accountAgeDays = Math.max(
    0,
    Math.floor((Date.now() - new Date(channelPublishedAt).getTime()) / (1000 * 60 * 60 * 24)),
  );

  const followerCount = toNonNegativeInt(channel.statistics?.subscriberCount);

  const result = await rebuildCreatorBaseline({
    userId: input.userId,
    platform: Platform.YOUTUBE,
    accountAgeDays,
    followerCount,
    posts,
  });

  return {
    ...result,
    source: {
      platform: 'YOUTUBE',
      sourceType: input.sourceType,
      channelId: input.channelId,
      channelTitle: channel.snippet?.title ?? null,
      accountAgeDays,
      followerCount,
      videosFetched: posts.length,
    },
  };
}

export async function rebuildYoutubeBaselineFromChannel(input: {
  userId: string;
  channelInput: string;
  maxResults?: number;
}) {
  const channelId = await resolveChannelId(input.channelInput);

  return buildYoutubeBaselineFromResolvedChannel({
    userId: input.userId,
    channelId,
    ...(input.maxResults !== undefined ? { maxResults: input.maxResults } : {}),
    sourceType: 'PUBLIC_LOOKUP',
  });
}

export async function rebuildYoutubeBaselineFromConnectedAccount(input: {
  userId: string;
  maxResults?: number;
}) {
  const connectedAccount = await prisma.connectedPlatformAccount.findFirst({
    where: {
      userId: input.userId,
      platform: Platform.YOUTUBE,
    },
    orderBy: [
      { isPrimary: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  if (!connectedAccount) {
    throw new Error('No connected YouTube account found');
  }

  const result = await buildYoutubeBaselineFromResolvedChannel({
    userId: input.userId,
    channelId: connectedAccount.providerAccountId,
    ...(input.maxResults !== undefined ? { maxResults: input.maxResults } : {}),
    sourceType: 'CONNECTED_ACCOUNT',
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

  return result;
}

export async function rebuildYoutubeAccountTrustScore(input: {
  userId: string;
  accountId: string;
}) {
  const connectedAccount = await prisma.connectedPlatformAccount.findFirst({
    where: { id: input.accountId, userId: input.userId, platform: Platform.YOUTUBE },
  });

  if (!connectedAccount) throw new Error('Connected YouTube account not found');

  const result = await buildYoutubeBaselineFromResolvedChannel({
    userId: input.userId,
    channelId: connectedAccount.providerAccountId,
    sourceType: 'CONNECTED_ACCOUNT',
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
