import { Platform, SubmissionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const DEFAULT_TRACKING_SCHEDULE_OFFSETS_MINUTES = [0, 300, 600, 900, 1200, 1800, 2400, 3000, 3600, 4320, 5040, 5760, 6480, 7200];
const ROLLING_TRACKING_EXTENSION_MINUTES = 720;
const ROLLING_TRACKING_START_AFTER_MINUTES = DEFAULT_TRACKING_SCHEDULE_OFFSETS_MINUTES[DEFAULT_TRACKING_SCHEDULE_OFFSETS_MINUTES.length - 1] ?? 7200;
const DEFAULT_MAX_DUE_JOBS = 10;
const MAX_TRACKING_ATTEMPTS = 3;
const INSTAGRAM_MEDIA_PAGE_LIMIT = 50;
const INSTAGRAM_MEDIA_SCAN_LIMIT = 100;
const TrackingJobStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

type TrackingJobStatusValue = (typeof TrackingJobStatus)[keyof typeof TrackingJobStatus];

const trackingJobDelegate = (prisma as any).submissionTrackingJob;

type TrackingJobSeed = {
  sequence: number;
  checkpointLabel: string;
  scheduledFor: Date;
};

type SubmissionReviewSignalLevel = 'INSUFFICIENT_DATA' | 'LOOKS_ORGANIC' | 'WATCH' | 'SUSPICIOUS';

type SubmissionMetrics = {
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
  engagementRatio: number | null;
  geographicIndiaPct: number | null;
};

type InstagramMediaResponse = {
  data?: Array<{
    id: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
  paging?: {
    next?: string;
  };
};

type InstagramMediaItem = {
  id: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type InstagramInsightResponse = {
  data?: Array<{
    values?: Array<{
      value?: number;
    }>;
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
};

function normalizeNonNegativeInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

function toNullableInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function computeEngagementRatio(input: {
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  shareCount: number | null;
}) {
  if (input.viewCount <= 0) return null;
  const totalEngagement = (input.likeCount ?? 0) + (input.commentCount ?? 0) + (input.shareCount ?? 0);
  return Number((totalEngagement / input.viewCount).toFixed(6));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getTrackingScheduleOffsetsMinutes() {
  const envValue = process.env.SUBMISSION_TRACKER_SCHEDULE_MINUTES?.trim();
  if (envValue) {
    const parsed = envValue
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .map((value) => Math.round(value));

    if (parsed.length > 0) {
      return Array.from(new Set(parsed)).sort((a, b) => a - b);
    }
  }

  return DEFAULT_TRACKING_SCHEDULE_OFFSETS_MINUTES;
}

function normalizeUrlForComparison(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    url.hash = '';
    url.search = '';
    url.protocol = 'https:';
    url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function parseInstagramCountFromHtml(html: string, label: string) {
  const patterns = [
    new RegExp(`"${label}"\\s*:\\s*\\{[^}]*"count"\\s*:\\s*(\\d+)`, 'i'),
    new RegExp(`${label}[^0-9]{0,40}(\\d[\\d,]*)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    const raw = match?.[1];
    if (!raw) continue;
    const normalized = raw.replace(/,/g, '');
    const value = toNullableInt(normalized);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

async function fetchInstagramSubmissionMetricsPublic(contentUrl: string): Promise<SubmissionMetrics> {
  const response = await fetch(contentUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  const html = await response.text();
  if (!response.ok) {
    throw new Error('Instagram page could not be fetched for public tracking');
  }

  const decodedHtml = decodeHtmlEntities(html);
  const likes = parseInstagramCountFromHtml(decodedHtml, 'edge_media_preview_like')
    ?? parseInstagramCountFromHtml(decodedHtml, 'like_count');
  const comments = parseInstagramCountFromHtml(decodedHtml, 'edge_media_to_comment')
    ?? parseInstagramCountFromHtml(decodedHtml, 'comment_count');
  const views = parseInstagramCountFromHtml(decodedHtml, 'video_view_count')
    ?? parseInstagramCountFromHtml(decodedHtml, 'view_count')
    ?? parseInstagramCountFromHtml(decodedHtml, 'play_count')
    ?? Math.max((likes ?? 0) + (comments ?? 0), 1);

  return {
    viewCount: normalizeNonNegativeInt(views),
    likeCount: likes,
    commentCount: comments,
    shareCount: null,
    engagementRatio: computeEngagementRatio({
      viewCount: normalizeNonNegativeInt(views),
      likeCount: likes,
      commentCount: comments,
      shareCount: null,
    }),
    geographicIndiaPct: null,
  };
}

function extractInstagramShortcode(value: string) {
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.split('/').filter(Boolean);
    const typeIndex = parts.findIndex((part) => part === 'p' || part === 'reel' || part === 'tv');
    if (typeIndex >= 0 && parts[typeIndex + 1]) {
      return parts[typeIndex + 1];
    }
  } catch {
  }
  return null;
}

function extractYouTubeVideoId(contentUrl: string): string {
  const trimmed = contentUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const [candidate] = url.pathname.split('/').filter(Boolean);
      if (candidate) return candidate;
    }

    if (hostname.endsWith('youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId;

      const parts = url.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((part) => part === 'shorts' || part === 'embed' || part === 'live');
      const candidate = markerIndex >= 0 ? parts[markerIndex + 1] : undefined;
      if (candidate) {
        return candidate;
      }
    }
  } catch {
  }

  throw new Error('Unable to determine the YouTube video ID from the submitted content URL');
}

function formatCheckpointLabel(offsetMinutes: number) {
  if (offsetMinutes === 0) return 'INITIAL';
  if (offsetMinutes < 60) return `MINUTE_${offsetMinutes}`;
  if (offsetMinutes % 60 === 0) return `HOUR_${Math.round(offsetMinutes / 60)}`;
  return `MINUTE_${offsetMinutes}`;
}

function buildTrackingJobSeeds(createdAt: Date): TrackingJobSeed[] {
  return getTrackingScheduleOffsetsMinutes().map((offsetMinutes, index) => ({
    sequence: index,
    checkpointLabel: formatCheckpointLabel(offsetMinutes),
    scheduledFor: new Date(createdAt.getTime() + offsetMinutes * 60 * 1000),
  }));
}

function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is required to track YouTube submissions');
  }
  return apiKey;
}

function getInstagramGraphBaseUrl() {
  return process.env.INSTAGRAM_GRAPH_BASE_URL ?? 'https://graph.instagram.com/v24.0';
}

async function youtubeGet<T>(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  url.searchParams.set('key', getYouTubeApiKey());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : 'YouTube API request failed';
    throw new Error(message);
  }

  return data as T;
}

async function instagramGet<T>(pathOrUrl: string, params: Record<string, string> = {}) {
  const url = pathOrUrl.startsWith('http') ? new URL(pathOrUrl) : new URL(`${getInstagramGraphBaseUrl()}${pathOrUrl}`);
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

async function fetchInstagramMediaViewMetric(accessToken: string, mediaId: string) {
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

async function fetchYouTubeSubmissionMetrics(contentUrl: string): Promise<SubmissionMetrics> {
  const videoId: string = extractYouTubeVideoId(contentUrl);
  const response = await youtubeGet<YouTubeVideosResponse>('videos', {
    part: 'statistics',
    id: videoId,
  });

  const video = response.items?.[0];
  if (!video) {
    throw new Error('Submitted YouTube video could not be found');
  }

  const viewCount = normalizeNonNegativeInt(video.statistics?.viewCount);
  const likeCount = toNullableInt(video.statistics?.likeCount);
  const commentCount = toNullableInt(video.statistics?.commentCount);
  const shareCount = null;

  return {
    viewCount,
    likeCount,
    commentCount,
    shareCount,
    engagementRatio: computeEngagementRatio({ viewCount, likeCount, commentCount, shareCount }),
    geographicIndiaPct: null,
  };
}

async function fetchInstagramSubmissionMetrics(input: {
  userId: string;
  contentUrl: string;
}): Promise<SubmissionMetrics> {
  const connectedAccount = await prisma.connectedPlatformAccount.findFirst({
    where: {
      userId: input.userId,
      platform: Platform.INSTAGRAM,
    },
    orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
  });

  const accessToken = connectedAccount?.accessToken;
  if (!accessToken) {
    return fetchInstagramSubmissionMetricsPublic(input.contentUrl);
  }

  const targetUrl = normalizeUrlForComparison(input.contentUrl);
  const targetShortcode = extractInstagramShortcode(input.contentUrl);
  let nextPage: string | null = null;
  let scanned = 0;

  while (scanned < INSTAGRAM_MEDIA_SCAN_LIMIT) {
    const response: InstagramMediaResponse = await instagramGet<InstagramMediaResponse>(
      nextPage ?? '/me/media',
      nextPage
        ? {}
        : {
            fields: 'id,permalink,timestamp,like_count,comments_count',
            limit: String(INSTAGRAM_MEDIA_PAGE_LIMIT),
            access_token: accessToken,
          },
    );

    const media: InstagramMediaItem[] = response.data ?? [];
    scanned += media.length;

    const matched = media.find((item: InstagramMediaItem) => {
      if (!item.permalink) return false;
      if (normalizeUrlForComparison(item.permalink) === targetUrl) return true;

      const permalinkShortcode = extractInstagramShortcode(item.permalink);
      return Boolean(targetShortcode && permalinkShortcode && permalinkShortcode === targetShortcode);
    });

    if (matched) {
      const likeCount = toNullableInt(matched.like_count);
      const commentCount = toNullableInt(matched.comments_count);
      const insightViews = await fetchInstagramMediaViewMetric(accessToken, matched.id);
      const viewCount = insightViews > 0 ? insightViews : Math.max((likeCount ?? 0) + (commentCount ?? 0), 1);
      const shareCount = null;

      return {
        viewCount,
        likeCount,
        commentCount,
        shareCount,
        engagementRatio: computeEngagementRatio({ viewCount, likeCount, commentCount, shareCount }),
        geographicIndiaPct: null,
      };
    }

    nextPage = response.paging?.next ?? null;
    if (!nextPage || media.length === 0) break;
  }

  return fetchInstagramSubmissionMetricsPublic(input.contentUrl);
}

export async function trackContentUrlMetrics(input: {
  userId: string;
  platform: Platform;
  contentUrl: string;
}) {
  const metrics =
    input.platform === Platform.YOUTUBE
      ? await fetchYouTubeSubmissionMetrics(input.contentUrl)
      : await fetchInstagramSubmissionMetrics({
          userId: input.userId,
          contentUrl: input.contentUrl,
        });

  return {
    platform: input.platform,
    contentUrl: input.contentUrl,
    trackedAt: new Date(),
    metrics,
  };
}

function buildGrowthTimeline(snapshots: Array<{
  capturedAt: Date;
  viewCount: number;
}>) {
  const timeline = [] as Array<{
    fromCapturedAt: Date;
    toCapturedAt: Date;
    deltaViews: number;
    deltaHours: number;
    velocityPerHour: number;
  }>;

  for (let index = 1; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const previous = snapshots[index - 1];
    if (!snapshot || !previous) {
      continue;
    }
    const deltaViews = snapshot.viewCount - previous.viewCount;
    const deltaMs = snapshot.capturedAt.getTime() - previous.capturedAt.getTime();
    const deltaHours = deltaMs <= 0 ? 0 : Number((deltaMs / (1000 * 60 * 60)).toFixed(2));
    const velocityPerHour = deltaHours <= 0 ? 0 : Number((deltaViews / deltaHours).toFixed(2));

    timeline.push({
      fromCapturedAt: previous.capturedAt,
      toCapturedAt: snapshot.capturedAt,
      deltaViews,
      deltaHours,
      velocityPerHour,
    });
  }

  return timeline;
}

function classifyGrowthPattern(growthTimeline: Array<{ deltaViews: number; velocityPerHour: number }>) {
  if (growthTimeline.length === 0) return 'INSUFFICIENT_DATA';
  if (growthTimeline.some((point) => point.deltaViews < 0)) return 'ANOMALOUS';

  const positiveVelocities = growthTimeline.map((point) => point.velocityPerHour).filter((value) => value > 0);
  if (positiveVelocities.length === 0) return 'FLAT';

  const maxVelocity = Math.max(...positiveVelocities);
  const minVelocity = Math.min(...positiveVelocities);
  if (minVelocity > 0 && maxVelocity / minVelocity >= 6) {
    return 'SPIKY';
  }

  return 'STEADY';
}

function buildTrackingSummary(snapshots: Array<{
  capturedAt: Date;
  viewCount: number;
  engagementRatio: number | null;
}>, trackingJobs: Array<{
  checkpointLabel: string;
  scheduledFor: Date;
  status: TrackingJobStatusValue;
}>, analysisStoppedAt: Date | null = null) {
  const orderedSnapshots = [...snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const growthTimeline = buildGrowthTimeline(orderedSnapshots.map((snapshot) => ({
    capturedAt: snapshot.capturedAt,
    viewCount: snapshot.viewCount,
  })));
  const engagementRatios = orderedSnapshots
    .map((snapshot) => snapshot.engagementRatio)
    .filter((value): value is number => typeof value === 'number');
  const latestSnapshot = orderedSnapshots[orderedSnapshots.length - 1] ?? null;
  const nextPendingJob = analysisStoppedAt
    ? null
    : trackingJobs
    .filter((job) => job.status === TrackingJobStatus.PENDING)
    .sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime())[0] ?? null;

  return {
    totalSnapshots: orderedSnapshots.length,
    latestSnapshot,
    averageEngagementRatio:
      engagementRatios.length === 0
        ? null
        : Number((engagementRatios.reduce((sum, value) => sum + value, 0) / engagementRatios.length).toFixed(6)),
    growthPattern: classifyGrowthPattern(growthTimeline),
    growthTimeline,
    analysisStoppedAt,
    trackingState: analysisStoppedAt ? 'STOPPED' : 'ACTIVE',
    nextPendingCheckpoint: nextPendingJob
      ? {
          checkpointLabel: nextPendingJob.checkpointLabel,
          scheduledFor: nextPendingJob.scheduledFor,
        }
      : null,
  };
}

function buildBaselineComparison(
  baseline: {
    avgViews: number;
    avgEngagementRate: number;
  } | null,
  latestSnapshot: {
    viewCount: number;
    engagementRatio: number | null;
  } | null,
) {
  if (!baseline || !latestSnapshot) {
    return null;
  }

  return {
    baselineAvgViews: baseline.avgViews,
    baselineAvgEngagementRate: baseline.avgEngagementRate,
    currentViews: latestSnapshot.viewCount,
    currentEngagementRatio: latestSnapshot.engagementRatio,
    viewVsBaselineRatio: baseline.avgViews > 0 ? Number((latestSnapshot.viewCount / baseline.avgViews).toFixed(4)) : null,
    engagementDeltaVsBaseline:
      latestSnapshot.engagementRatio === null
        ? null
        : Number((latestSnapshot.engagementRatio - baseline.avgEngagementRate).toFixed(6)),
  };
}

function getPositiveVelocitySpread(growthTimeline: Array<{ velocityPerHour: number }>) {
  const positiveVelocities = growthTimeline.map((point) => point.velocityPerHour).filter((value) => value > 0);
  if (positiveVelocities.length < 2) {
    return null;
  }

  const maxVelocity = Math.max(...positiveVelocities);
  const minVelocity = Math.min(...positiveVelocities);
  if (minVelocity <= 0) {
    return null;
  }

  return Number((maxVelocity / minVelocity).toFixed(4));
}

function averageNumbers(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function coefficientOfVariation(values: number[]) {
  const average = averageNumbers(values);
  if (average <= 0) {
    return 0;
  }

  const variance = averageNumbers(values.map((value) => (value - average) ** 2));
  return Math.sqrt(variance) / average;
}

function buildObservationIntervals(snapshots: Array<{
  capturedAt: Date;
  viewCount: number;
  likeCount: number | null;
  commentCount: number | null;
  engagementRatio: number | null;
}>) {
  const intervals = [] as Array<{
    fromCapturedAt: Date;
    toCapturedAt: Date;
    deltaHours: number;
    deltaViews: number;
    deltaLikes: number | null;
    deltaComments: number | null;
    deltaInteractions: number | null;
    interactionDensity: number | null;
  }>;

  for (let index = 1; index < snapshots.length; index += 1) {
    const previous = snapshots[index - 1];
    const current = snapshots[index];
    if (!previous || !current) {
      continue;
    }

    const deltaMs = current.capturedAt.getTime() - previous.capturedAt.getTime();
    const deltaHours = deltaMs <= 0 ? 0 : Number((deltaMs / (1000 * 60 * 60)).toFixed(2));
    const deltaViews = current.viewCount - previous.viewCount;
    const deltaLikes = previous.likeCount === null || current.likeCount === null ? null : current.likeCount - previous.likeCount;
    const deltaComments = previous.commentCount === null || current.commentCount === null ? null : current.commentCount - previous.commentCount;
    const deltaInteractions = deltaLikes === null && deltaComments === null ? null : (deltaLikes ?? 0) + (deltaComments ?? 0);
    const interactionDensity = deltaViews <= 0 || deltaInteractions === null
      ? null
      : Number((Math.max(deltaInteractions, 0) / deltaViews).toFixed(6));

    intervals.push({
      fromCapturedAt: previous.capturedAt,
      toCapturedAt: current.capturedAt,
      deltaHours,
      deltaViews,
      deltaLikes,
      deltaComments,
      deltaInteractions,
      interactionDensity,
    });
  }

  return intervals;
}

function analyzeSubmissionReviewSignals(input: {
  snapshots: Array<{
    capturedAt: Date;
    viewCount: number;
    likeCount: number | null;
    commentCount: number | null;
    engagementRatio: number | null;
  }>;
  trackingJobs: Array<{
    checkpointLabel: string;
    scheduledFor: Date;
    status: TrackingJobStatusValue;
  }>;
  baseline: {
    avgViews: number;
    avgEngagementRate: number;
  } | null;
  analysisStoppedAt: Date | null;
}) {
  const orderedSnapshots = [...input.snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const initialSnapshot = orderedSnapshots[0] ?? null;
  const latestSnapshot = orderedSnapshots[orderedSnapshots.length - 1] ?? null;
  const observationIntervals = buildObservationIntervals(orderedSnapshots);
  const summary = buildTrackingSummary(
    orderedSnapshots.map((snapshot) => ({
      capturedAt: snapshot.capturedAt,
      viewCount: snapshot.viewCount,
      engagementRatio: snapshot.engagementRatio,
    })),
    input.trackingJobs,
    input.analysisStoppedAt,
  );
  const baselineComparison = buildBaselineComparison(input.baseline, latestSnapshot);
  const completedCheckpoints = input.trackingJobs.filter((job) => job.status === TrackingJobStatus.COMPLETED).length;
  const pendingCheckpoints = input.trackingJobs.filter((job) => job.status === TrackingJobStatus.PENDING).length;
  const failedCheckpoints = input.trackingJobs.filter((job) => job.status === TrackingJobStatus.FAILED).length;
  const totalCheckpoints = input.trackingJobs.length;
  const concernReasons = [] as string[];
  const positiveSignals = [] as string[];

  if (!initialSnapshot || !latestSnapshot) {
    return {
      signalLevel: 'INSUFFICIENT_DATA' as SubmissionReviewSignalLevel,
      analysisStopped: input.analysisStoppedAt !== null,
      hasPendingCheckpoints: pendingCheckpoints > 0,
      riskScore: 100,
      confidenceScore: 0,
      reasons: ['Not enough snapshots have been collected yet to generate a useful admin review signal.'],
      positiveSignals,
      concerns: concernReasons,
      completedCheckpoints,
      pendingCheckpoints,
      totalCheckpoints,
      signals: {
        initialViews: initialSnapshot?.viewCount ?? null,
        latestViews: latestSnapshot?.viewCount ?? null,
        totalGrowthViews: null,
        totalGrowthPct: null,
        observationWindowHours: null,
        averageEngagementRatio: summary.averageEngagementRatio,
        latestEngagementRatio: latestSnapshot?.engagementRatio ?? null,
        growthPattern: summary.growthPattern,
        velocitySpreadRatio: getPositiveVelocitySpread(summary.growthTimeline),
        baselineViewRatio: baselineComparison?.viewVsBaselineRatio ?? null,
        engagementDeltaVsBaseline: baselineComparison?.engagementDeltaVsBaseline ?? null,
        overallInteractionDensity: null,
        maxGrowthShare: null,
        lowInteractionIntervals: 0,
        engagementTrendRatio: null,
        baselineEngagementRatio: null,
      },
    };
  }

  const totalGrowthViews = latestSnapshot.viewCount - initialSnapshot.viewCount;
  const totalGrowthPct = initialSnapshot.viewCount > 0 ? Number((totalGrowthViews / initialSnapshot.viewCount).toFixed(6)) : null;
  const observationWindowHours = Number(((latestSnapshot.capturedAt.getTime() - initialSnapshot.capturedAt.getTime()) / (1000 * 60 * 60)).toFixed(2));
  const latestEngagementRatio = latestSnapshot.engagementRatio;
  const velocitySpreadRatio = getPositiveVelocitySpread(summary.growthTimeline);
  const positiveVelocities = summary.growthTimeline.map((point) => point.velocityPerHour).filter((value) => value > 0);
  const velocityCv = positiveVelocities.length < 2 ? null : Number(coefficientOfVariation(positiveVelocities).toFixed(4));
  const positiveIntervals = observationIntervals.filter((interval) => interval.deltaViews > 0);
  const negativeViewIntervals = observationIntervals.filter((interval) => interval.deltaViews < 0);
  const negativeLikeIntervals = observationIntervals.filter((interval) => interval.deltaLikes !== null && interval.deltaLikes < -3);
  const negativeCommentIntervals = observationIntervals.filter((interval) => interval.deltaComments !== null && interval.deltaComments < -3);
  const intervalsWithInteractionSignals = positiveIntervals.filter((interval) => interval.interactionDensity !== null);
  const totalInteractionGrowth = intervalsWithInteractionSignals.length === 0
    ? null
    : intervalsWithInteractionSignals.reduce((sum, interval) => sum + Math.max(interval.deltaInteractions ?? 0, 0), 0);
  const overallInteractionDensity =
    totalGrowthViews > 0 && totalInteractionGrowth !== null
      ? Number((totalInteractionGrowth / totalGrowthViews).toFixed(6))
      : null;
  const dominantInterval = positiveIntervals.reduce<typeof positiveIntervals[number] | null>((currentDominant, interval) => {
    if (!currentDominant || interval.deltaViews > currentDominant.deltaViews) {
      return interval;
    }

    return currentDominant;
  }, null);
  const maxGrowthShare = dominantInterval && totalGrowthViews > 0
    ? Number((dominantInterval.deltaViews / totalGrowthViews).toFixed(4))
    : null;
  const lowInteractionThreshold = overallInteractionDensity === null ? 0.001 : Math.max(0.001, Number((overallInteractionDensity * 0.2).toFixed(6)));
  const lowInteractionIntervals = positiveIntervals.filter((interval) => (
    interval.deltaViews >= Math.max(75, totalGrowthViews * 0.12)
    && interval.interactionDensity !== null
    && interval.interactionDensity < lowInteractionThreshold
  ));
  const dominantGrowthWithoutInteractionSupport = Boolean(
    dominantInterval
      && maxGrowthShare !== null
      && maxGrowthShare >= 0.55
      && dominantInterval.interactionDensity !== null
      && dominantInterval.interactionDensity < lowInteractionThreshold,
  );
  const initialEngagementRatio = initialSnapshot.engagementRatio;
  const engagementTrendRatio =
    initialEngagementRatio !== null
    && initialEngagementRatio > 0
    && latestEngagementRatio !== null
      ? Number((latestEngagementRatio / initialEngagementRatio).toFixed(4))
      : null;
  const baselineEngagementRatio =
    input.baseline
    && latestEngagementRatio !== null
    && input.baseline.avgEngagementRate > 0
      ? Number((latestEngagementRatio / input.baseline.avgEngagementRate).toFixed(4))
      : null;
  const likeCoverageComplete = orderedSnapshots.every((snapshot) => snapshot.likeCount !== null);
  const commentCoverageComplete = orderedSnapshots.every((snapshot) => snapshot.commentCount !== null);
  let riskScore = 0;

  if (pendingCheckpoints > 0 && input.analysisStoppedAt === null) {
    riskScore += 18;
    concernReasons.push('More scheduled checkpoints are still pending, so the admin signal is based on a partial observation window.');
  }

  if (orderedSnapshots.length < 5) {
    riskScore += 24;
    concernReasons.push('Fewer than 5 snapshots were captured, so the signal is still based on limited evidence.');
  }

  if (observationWindowHours < 1) {
    riskScore += 18;
    concernReasons.push('The observed window is shorter than 1 hour, so the current signal is still early and unstable.');
  }

  if (negativeViewIntervals.length > 0 || summary.growthPattern === 'ANOMALOUS') {
    riskScore += 45;
    concernReasons.push('Views dropped between checkpoints, which is inconsistent with a clean organic progression.');
  }

  if (negativeLikeIntervals.length > 0) {
    riskScore += 10;
    concernReasons.push('Like counts decreased materially between checkpoints, so the interaction trail is less trustworthy.');
  }

  if (negativeCommentIntervals.length > 0) {
    riskScore += 8;
    concernReasons.push('Comment counts decreased materially between checkpoints, so the interaction trail is less trustworthy.');
  }

  if (totalGrowthViews <= 0) {
    riskScore += 35;
    concernReasons.push('The video did not gain views during the observed window.');
  }

  if (!likeCoverageComplete && !commentCoverageComplete) {
    riskScore += 20;
    concernReasons.push('Interaction data is unavailable across the full window, so the admin signal cannot fully validate view support.');
  }

  if (latestEngagementRatio === null) {
    riskScore += 15;
    concernReasons.push('Latest engagement ratio is unavailable, so unsupported view growth cannot be ruled out.');
  } else if (latestEngagementRatio < 0.0004) {
    riskScore += 30;
    concernReasons.push('Engagement is extremely low relative to the current view count.');
  } else if (latestEngagementRatio < 0.001 && latestSnapshot.viewCount >= 1000) {
    riskScore += 16;
    concernReasons.push('Engagement is weak relative to the current view count.');
  }

  if (engagementTrendRatio !== null && engagementTrendRatio < 0.45 && totalGrowthViews >= 500) {
    riskScore += 18;
    concernReasons.push('Engagement density fell sharply as views accumulated across the observed window.');
  }

  if (lowInteractionIntervals.length >= 2) {
    riskScore += 35;
    concernReasons.push('Multiple growth intervals added significant views without matching interaction support.');
  } else if (lowInteractionIntervals.length === 1) {
    riskScore += 20;
    concernReasons.push('One growth interval added significant views with unusually weak interaction support.');
  }

  if (dominantGrowthWithoutInteractionSupport) {
    riskScore += 20;
    concernReasons.push('A dominant share of total growth came from one interval without proportional interaction gains.');
  }

  if (
    velocitySpreadRatio !== null
    && velocitySpreadRatio >= 10
    && (lowInteractionIntervals.length > 0 || dominantGrowthWithoutInteractionSupport || (engagementTrendRatio !== null && engagementTrendRatio < 0.45))
  ) {
    riskScore += 12;
    concernReasons.push('Growth velocity varied sharply alongside weak interaction support.');
  }

  if (velocityCv !== null && velocityCv >= 1.4 && lowInteractionIntervals.length > 0) {
    riskScore += 8;
    concernReasons.push('View velocity was highly unstable during intervals that already showed weak interaction support.');
  }

  if (baselineComparison) {
    const baselineViewRatio = baselineComparison.viewVsBaselineRatio;

    if (baselineViewRatio !== null && baselineEngagementRatio !== null) {
      if (baselineViewRatio >= 4 && baselineEngagementRatio < 0.45) {
        riskScore += 22;
        concernReasons.push('Views ran far above creator baseline while engagement quality lagged well behind baseline.');
      } else if (baselineViewRatio >= 2.5 && baselineEngagementRatio < 0.35) {
        riskScore += 12;
        concernReasons.push('View growth outpaced creator baseline without comparable engagement quality.');
      }

      if (baselineEngagementRatio < 0.25) {
        riskScore += 15;
        concernReasons.push('Engagement quality is dramatically below the creator baseline.');
      }
    }
  }

  if (failedCheckpoints > 0) {
    riskScore += 15;
    concernReasons.push('One or more scheduled tracking checkpoints failed, so the collected evidence is incomplete.');
  }

  if (negativeViewIntervals.length === 0) {
    positiveSignals.push('Views increased monotonically across the observed window.');
  }

  if (totalGrowthViews > 0 && positiveIntervals.length >= Math.max(3, Math.min(4, observationIntervals.length))) {
    positiveSignals.push('The video kept gaining views across repeated checkpoints rather than through a single unsupported jump.');
  }

  if (overallInteractionDensity !== null && overallInteractionDensity >= 0.003) {
    positiveSignals.push('Interaction growth stayed healthy relative to added views throughout the observation window.');
  }

  if (engagementTrendRatio !== null && engagementTrendRatio >= 0.8) {
    positiveSignals.push('Engagement ratio stayed stable or improved as the video accumulated more views.');
  }

  if (lowInteractionIntervals.length === 0 && !dominantGrowthWithoutInteractionSupport) {
    positiveSignals.push('No large burst of views appeared without matching interaction support.');
  }

  if (baselineComparison && baselineEngagementRatio !== null && baselineEngagementRatio >= 0.75) {
    positiveSignals.push('Engagement quality remained in line with the creator baseline.');
  }

  riskScore = clamp(Number(riskScore.toFixed(2)), 0, 100);
  const confidenceScore = Number((100 - riskScore).toFixed(2));
  const hasInsufficientData = orderedSnapshots.length < 3 || observationWindowHours < 5;
  const signalLevel: SubmissionReviewSignalLevel = hasInsufficientData
    ? 'INSUFFICIENT_DATA'
    : riskScore >= 60
      ? 'SUSPICIOUS'
      : riskScore >= 30
        ? 'WATCH'
        : 'LOOKS_ORGANIC';

  const reasons = signalLevel === 'LOOKS_ORGANIC'
    ? (positiveSignals.length > 0
        ? positiveSignals.slice(0, 5)
        : ['The observed pattern looks stable so far, but final payment still depends on admin verification.'])
    : (concernReasons.length > 0
        ? concernReasons
        : ['More checkpoints are needed before the system can provide a confident admin signal.']);

  return {
    signalLevel,
    analysisStopped: input.analysisStoppedAt !== null,
    hasPendingCheckpoints: pendingCheckpoints > 0,
    riskScore,
    confidenceScore,
    reasons,
    positiveSignals: positiveSignals.slice(0, 5),
    concerns: concernReasons,
    completedCheckpoints,
    pendingCheckpoints,
    totalCheckpoints,
    signals: {
      initialViews: initialSnapshot.viewCount,
      latestViews: latestSnapshot.viewCount,
      totalGrowthViews,
      totalGrowthPct,
      observationWindowHours,
      averageEngagementRatio: summary.averageEngagementRatio,
      latestEngagementRatio,
      growthPattern: summary.growthPattern,
      velocitySpreadRatio,
      baselineViewRatio: baselineComparison?.viewVsBaselineRatio ?? null,
      engagementDeltaVsBaseline: baselineComparison?.engagementDeltaVsBaseline ?? null,
      overallInteractionDensity,
      maxGrowthShare,
      lowInteractionIntervals: lowInteractionIntervals.length,
      engagementTrendRatio,
      baselineEngagementRatio,
    },
  };
}

async function ensureRollingTrackingJobForSubmission(submissionId: string) {
  const submission = (await (prisma.contentSubmission as any).findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      createdAt: true,
      analysisStoppedAt: true,
      trackingJobs: {
        orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
      },
    },
  })) as any;

  if (!submission || submission.analysisStoppedAt) {
    return null;
  }

  const openJobs = submission.trackingJobs.filter((job: any) => (
    job.status === TrackingJobStatus.PENDING
    || job.status === TrackingJobStatus.PROCESSING
    || (job.status === TrackingJobStatus.FAILED && job.attemptCount < MAX_TRACKING_ATTEMPTS)
  ));
  if (openJobs.length > 0) {
    return null;
  }

  const latestJob = submission.trackingJobs[submission.trackingJobs.length - 1] ?? null;
  if (!latestJob) {
    return null;
  }

  const latestOffsetMinutes = Math.round((latestJob.scheduledFor.getTime() - submission.createdAt.getTime()) / (1000 * 60));
  if (latestOffsetMinutes < ROLLING_TRACKING_START_AFTER_MINUTES) {
    return null;
  }

  const nextOffsetMinutes = latestOffsetMinutes + ROLLING_TRACKING_EXTENSION_MINUTES;

  try {
    return await trackingJobDelegate.create({
      data: {
        submissionId,
        sequence: latestJob.sequence + 1,
        checkpointLabel: formatCheckpointLabel(nextOffsetMinutes),
        scheduledFor: new Date(submission.createdAt.getTime() + nextOffsetMinutes * 60 * 1000),
      },
    });
  } catch {
    return null;
  }
}

async function refreshSubmissionReviewSignals(submissionId: string) {
  const submission = (await (prisma.contentSubmission as any).findUnique({
    where: { id: submissionId },
    include: {
      metricSnapshots: {
        orderBy: {
          capturedAt: 'asc',
        },
      },
      trackingJobs: {
        orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
      },
    },
  })) as any;

  if (!submission) {
    return null;
  }

  const baseline = await prisma.creatorBaseline.findUnique({
    where: {
      creatorId_platform: {
        creatorId: submission.creatorId,
        platform: submission.platform,
      },
    },
  });

  const reviewSignals = analyzeSubmissionReviewSignals({
    snapshots: submission.metricSnapshots,
    trackingJobs: submission.trackingJobs,
    baseline,
    analysisStoppedAt: submission.analysisStoppedAt,
  });

  await prisma.contentSubmission.update({
    where: { id: submissionId },
    data: {
      status:
        submission.status === SubmissionStatus.APPROVED
        || submission.status === SubmissionStatus.PAID
        || submission.status === SubmissionStatus.REJECTED
          ? submission.status
          : SubmissionStatus.UNDER_REVIEW,
      fraudScore: reviewSignals.riskScore,
      verifiedViews: null,
    },
  });

  return reviewSignals;
}

async function getCreatorProfileByUserId(userId: string) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) {
    throw new Error('Creator profile not found');
  }
  return creatorProfile;
}

async function getOwnedSubmission(userId: string, submissionId: string) {
  const creatorProfile = await getCreatorProfileByUserId(userId);
  const submission = (await prisma.contentSubmission.findFirst({
    where: {
      id: submissionId,
      creatorId: creatorProfile.id,
    },
    include: {
      creator: {
        select: {
          userId: true,
        },
      },
      campaign: {
        select: {
          title: true,
          cpvRate: true,
        },
      },
    },
  })) as any;

  if (!submission) {
    throw new Error('Submission not found');
  }

  return submission;
}

async function captureSubmissionSnapshotRecord(input: {
  submissionId: string;
  creatorUserId: string;
  platform: Platform;
  contentUrl: string;
}) {
  const metrics =
    input.platform === Platform.YOUTUBE
      ? await fetchYouTubeSubmissionMetrics(input.contentUrl)
      : await fetchInstagramSubmissionMetrics({
          userId: input.creatorUserId,
          contentUrl: input.contentUrl,
        });

  const snapshot = await prisma.metricSnapshot.create({
    data: {
      submissionId: input.submissionId,
      viewCount: metrics.viewCount,
      likeCount: metrics.likeCount,
      commentCount: metrics.commentCount,
      shareCount: metrics.shareCount,
      engagementRatio: metrics.engagementRatio,
      geographicIndiaPct: metrics.geographicIndiaPct,
    },
  });

  await prisma.contentSubmission.update({
    where: { id: input.submissionId },
    data: {
      lastCheckedAt: snapshot.capturedAt,
      status: SubmissionStatus.UNDER_REVIEW,
    },
  });

  return snapshot;
}

async function completeOldestDueTrackingJobForSubmission(submissionId: string, capturedAt: Date) {
  const dueJob = await trackingJobDelegate.findFirst({
    where: {
      submissionId,
      scheduledFor: {
        lte: capturedAt,
      },
      OR: [
        { status: TrackingJobStatus.PENDING },
        {
          status: TrackingJobStatus.FAILED,
          attemptCount: {
            lt: MAX_TRACKING_ATTEMPTS,
          },
        },
      ],
    },
    orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
  });

  if (!dueJob) {
    return null;
  }

  await trackingJobDelegate.update({
    where: { id: dueJob.id },
    data: {
      status: TrackingJobStatus.COMPLETED,
      completedAt: capturedAt,
      processingStartedAt: null,
      lastError: null,
    },
  });

  return dueJob.id;
}

export function buildSubmissionTrackingJobs(createdAt: Date) {
  return buildTrackingJobSeeds(createdAt);
}

export async function trackSubmissionNow(userId: string, submissionId: string) {
  const submission = await getOwnedSubmission(userId, submissionId);
  if (submission.analysisStoppedAt) {
    throw new Error('Analysis has already been stopped for this submission');
  }
  const snapshot = await captureSubmissionSnapshotRecord({
    submissionId: submission.id,
    creatorUserId: submission.creator.userId,
    platform: submission.platform,
    contentUrl: submission.contentUrl,
  });

  await completeOldestDueTrackingJobForSubmission(submission.id, snapshot.capturedAt);
  await ensureRollingTrackingJobForSubmission(submission.id);
  await refreshSubmissionReviewSignals(submission.id);

  const tracking = await getSubmissionTracking(userId, submissionId);
  return {
    snapshot,
    tracking,
  };
}

export async function stopSubmissionAnalysis(userId: string, submissionId: string) {
  const submission = await getOwnedSubmission(userId, submissionId);
  if (!submission.analysisStoppedAt) {
    await (prisma.contentSubmission as any).update({
      where: { id: submission.id },
      data: {
        analysisStoppedAt: new Date(),
        status: SubmissionStatus.UNDER_REVIEW,
      },
    });
  }

  await refreshSubmissionReviewSignals(submission.id);
  return getSubmissionTracking(userId, submissionId);
}

export async function processDueTrackingJobs(input: {
  userId?: string;
  maxJobs?: number;
}) {
  if (input.userId) {
    await getCreatorProfileByUserId(input.userId);
  }

  const jobs = await trackingJobDelegate.findMany({
    where: {
      submission: {
        analysisStoppedAt: null,
        ...(input.userId
          ? {
              creator: {
                userId: input.userId,
              },
            }
          : {}),
      },
      scheduledFor: {
        lte: new Date(),
      },
      OR: [
        { status: TrackingJobStatus.PENDING },
        {
          status: TrackingJobStatus.FAILED,
          attemptCount: {
            lt: MAX_TRACKING_ATTEMPTS,
          },
        },
      ],
    },
    include: {
      submission: {
        include: {
          creator: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
    orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
    take: Math.min(Math.max(input.maxJobs ?? DEFAULT_MAX_DUE_JOBS, 1), 50),
  });

  const results = [] as Array<{
    jobId: string;
    submissionId: string;
    checkpointLabel: string;
    status: 'COMPLETED' | 'FAILED' | 'SKIPPED';
    snapshotId?: string;
    error?: string;
  }>;

  for (const job of jobs) {
    const claimed = await trackingJobDelegate.updateMany({
      where: {
        id: job.id,
        status: job.status,
      },
      data: {
        status: TrackingJobStatus.PROCESSING,
        processingStartedAt: new Date(),
        attemptCount: job.attemptCount + 1,
        lastError: null,
      },
    });

    if (claimed.count === 0) {
      results.push({
        jobId: job.id,
        submissionId: job.submissionId,
        checkpointLabel: job.checkpointLabel,
        status: 'SKIPPED',
      });
      continue;
    }

    try {
      const snapshot = await captureSubmissionSnapshotRecord({
        submissionId: job.submissionId,
        creatorUserId: job.submission.creator.userId,
        platform: job.submission.platform,
        contentUrl: job.submission.contentUrl,
      });

      await trackingJobDelegate.update({
        where: { id: job.id },
        data: {
          status: TrackingJobStatus.COMPLETED,
          completedAt: new Date(),
          processingStartedAt: null,
          lastError: null,
        },
      });

      results.push({
        jobId: job.id,
        submissionId: job.submissionId,
        checkpointLabel: job.checkpointLabel,
        status: 'COMPLETED',
        snapshotId: snapshot.id,
      });

      await ensureRollingTrackingJobForSubmission(job.submissionId);
      await refreshSubmissionReviewSignals(job.submissionId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tracking failed';
      await trackingJobDelegate.update({
        where: { id: job.id },
        data: {
          status: TrackingJobStatus.FAILED,
          processingStartedAt: null,
          lastError: message,
        },
      });

      results.push({
        jobId: job.id,
        submissionId: job.submissionId,
        checkpointLabel: job.checkpointLabel,
        status: 'FAILED',
        error: message,
      });
    }
  }

  return {
    processedCount: results.filter((result) => result.status === 'COMPLETED').length,
    failedCount: results.filter((result) => result.status === 'FAILED').length,
    skippedCount: results.filter((result) => result.status === 'SKIPPED').length,
    results,
  };
}

function buildSubmissionTrackingPayload(input: {
  submission: any;
  reviewSignals: any;
}) {
  const { submission, reviewSignals } = input;

  return {
    submission: {
      id: submission.id,
      campaignId: submission.campaignId,
      campaignTitle: submission.campaign.title,
      platform: submission.platform,
      contentUrl: submission.contentUrl,
      status: submission.status,
      verifiedViews: submission.verifiedViews,
      lastCheckedAt: submission.lastCheckedAt,
      analysisStoppedAt: submission.analysisStoppedAt,
      fraudScore: submission.fraudScore,
      createdAt: submission.createdAt,
      creator: submission.creator
        ? {
            id: submission.creator.id,
            displayName: submission.creator.displayName,
            userId: submission.creator.userId,
          }
        : null,
      campaign: {
        id: submission.campaign.id,
        title: submission.campaign.title,
        cpvRate: submission.campaign.cpvRate,
        minimumPayoutViews: submission.campaign.minimumPayoutViews,
        maxPayoutPerSubmission: submission.campaign.maxPayoutPerSubmission,
        startDate: submission.campaign.startDate,
        endDate: submission.campaign.endDate,
      },
      estimatedCurrentValue:
        submission.metricSnapshots.length === 0
          ? 0
          : Number((submission.metricSnapshots[submission.metricSnapshots.length - 1].viewCount * Number(submission.campaign.cpvRate)).toFixed(2)),
    },
    reviewSignals,
    trackingJobs: submission.trackingJobs,
    snapshots: submission.metricSnapshots,
    summary: buildTrackingSummary(submission.metricSnapshots, submission.trackingJobs, submission.analysisStoppedAt),
  };
}

export async function getSubmissionTracking(userId: string, submissionId: string) {
  const creatorProfile = await getCreatorProfileByUserId(userId);
  const submission = (await (prisma.contentSubmission as any).findFirst({
    where: {
      id: submissionId,
      creatorId: creatorProfile.id,
    },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          cpvRate: true,
          minimumPayoutViews: true,
          maxPayoutPerSubmission: true,
          startDate: true,
          endDate: true,
        },
      },
      creator: {
        select: {
          id: true,
          displayName: true,
          userId: true,
        },
      },
      metricSnapshots: {
        orderBy: {
          capturedAt: 'asc',
        },
      },
      trackingJobs: {
        orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
      },
    },
  })) as any;

  if (!submission) {
    throw new Error('Submission not found');
  }

  const baseline = await prisma.creatorBaseline.findUnique({
    where: {
      creatorId_platform: {
        creatorId: creatorProfile.id,
        platform: submission.platform,
      },
    },
  });

  const reviewSignals = analyzeSubmissionReviewSignals({
    snapshots: submission.metricSnapshots,
    trackingJobs: submission.trackingJobs,
    baseline,
    analysisStoppedAt: submission.analysisStoppedAt,
  });

  return buildSubmissionTrackingPayload({ submission, reviewSignals });
}

export async function getSubmissionTrackingForAdmin(submissionId: string) {
  const submission = (await (prisma.contentSubmission as any).findUnique({
    where: { id: submissionId },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          cpvRate: true,
          minimumPayoutViews: true,
          maxPayoutPerSubmission: true,
          startDate: true,
          endDate: true,
        },
      },
      creator: {
        select: {
          id: true,
          displayName: true,
          userId: true,
        },
      },
      metricSnapshots: {
        orderBy: {
          capturedAt: 'asc',
        },
      },
      trackingJobs: {
        orderBy: [{ scheduledFor: 'asc' }, { sequence: 'asc' }],
      },
    },
  })) as any;

  if (!submission) {
    throw new Error('Submission not found');
  }

  const baseline = await prisma.creatorBaseline.findUnique({
    where: {
      creatorId_platform: {
        creatorId: submission.creatorId,
        platform: submission.platform,
      },
    },
  });

  const reviewSignals = analyzeSubmissionReviewSignals({
    snapshots: submission.metricSnapshots,
    trackingJobs: submission.trackingJobs,
    baseline,
    analysisStoppedAt: submission.analysisStoppedAt,
  });

  return buildSubmissionTrackingPayload({ submission, reviewSignals });
}
