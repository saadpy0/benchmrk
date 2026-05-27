import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { getMySubmissions, submitContent } from '../campaigns/submission.service.js';
import { getSubmissionTracking, processDueTrackingJobs, stopSubmissionAnalysis, trackSubmissionNow } from '../campaigns/submission-tracking.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const DEV_CREATOR_EMAIL = 'dev-creator@benchmrk.local';
const DEV_BRAND_EMAIL = 'dev-brand@benchmrk.local';

function extractYouTubeVideoId(contentUrl: string) {
  const trimmed = contentUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();

    if (hostname === 'youtu.be') {
      const candidate = url.pathname.split('/').filter(Boolean)[0];
      return candidate || null;
    }

    if (hostname.endsWith('youtube.com')) {
      const watchId = url.searchParams.get('v');
      if (watchId) return watchId;

      const parts = url.pathname.split('/').filter(Boolean);
      const markerIndex = parts.findIndex((part) => part === 'shorts' || part === 'embed' || part === 'live');
      const candidate = markerIndex >= 0 ? parts[markerIndex + 1] : undefined;
      return candidate || null;
    }
  } catch {
  }

  return null;
}

function extractInstagramShortcode(contentUrl: string) {
  try {
    const url = new URL(contentUrl.trim());
    const parts = url.pathname.split('/').filter(Boolean);
    const markerIndex = parts.findIndex((part) => part === 'p' || part === 'reel' || part === 'tv');
    return markerIndex >= 0 ? parts[markerIndex + 1] || null : null;
  } catch {
    return null;
  }
}

async function ensureDevCreator() {
  const user = await prisma.user.upsert({
    where: { email: DEV_CREATOR_EMAIL },
    update: { role: 'CREATOR' },
    create: {
      email: DEV_CREATOR_EMAIL,
      passwordHash: 'dev-only-hidden-login',
      role: 'CREATOR',
    },
  });

  const creatorProfile = await prisma.creatorProfile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: 'Dev Creator',
      bio: 'Auto-created dev creator for YouTube baseline and tracking tests',
    },
  });

  await prisma.creatorWallet.upsert({
    where: { creatorId: creatorProfile.id },
    update: {},
    create: { creatorId: creatorProfile.id },
  });

  return { user, creatorProfile };
}

async function ensureDevBrand() {
  const user = await prisma.user.upsert({
    where: { email: DEV_BRAND_EMAIL },
    update: { role: 'BRAND' },
    create: {
      email: DEV_BRAND_EMAIL,
      passwordHash: 'dev-only-brand-login',
      role: 'BRAND',
    },
  });

  const brandProfile = await prisma.brandProfile.upsert({
    where: { userId: user.id },
    update: {
      companyName: 'Benchmrk Dev Brand',
      gstNumber: 'DEV-GST-001',
    },
    create: {
      userId: user.id,
      companyName: 'Benchmrk Dev Brand',
      gstNumber: 'DEV-GST-001',
    },
  });

  return { user, brandProfile };
}

async function ensureCreatorAcceptedForCampaign(userId: string, campaignId: string) {
  const creatorProfile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!creatorProfile) {
    throw new Error('Creator profile not found');
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) {
    throw new Error('Campaign not found');
  }
  if (campaign.status !== 'LIVE') {
    throw new Error('Only LIVE campaigns can accept submissions');
  }

  await prisma.application.upsert({
    where: {
      campaignId_creatorId: {
        campaignId,
        creatorId: creatorProfile.id,
      },
    },
    update: {
      status: 'ACCEPTED',
    },
    create: {
      campaignId,
      creatorId: creatorProfile.id,
      status: 'ACCEPTED',
    },
  });

  return { creatorProfile, campaign };
}

async function buildYouTubeAnalysis(userId: string, submissionId: string) {
  const [creatorProfile, tracking] = await Promise.all([
    prisma.creatorProfile.findUnique({
      where: { userId },
      select: { id: true, reputationScore: true },
    }),
    getSubmissionTracking(userId, submissionId),
  ]);

  const baseline = creatorProfile
    ? await prisma.creatorBaseline.findUnique({
        where: {
          creatorId_platform: {
            creatorId: creatorProfile.id,
            platform: Platform.YOUTUBE,
          },
        },
      })
    : null;

  const latestSnapshot = tracking.summary.latestSnapshot;
  const baselineComparison = baseline && latestSnapshot
    ? {
        baselineAvgViews: baseline.avgViews,
        baselineAvgEngagementRate: baseline.avgEngagementRate,
        currentViews: latestSnapshot.viewCount,
        currentEngagementRatio: latestSnapshot.engagementRatio,
        viewVsBaselineRatio: baseline.avgViews > 0 ? Number((latestSnapshot.viewCount / baseline.avgViews).toFixed(4)) : null,
        engagementDeltaVsBaseline:
          latestSnapshot.engagementRatio === null
            ? null
            : Number((latestSnapshot.engagementRatio - baseline.avgEngagementRate).toFixed(6)),
      }
    : null;

  return {
    videoId: extractYouTubeVideoId(tracking.submission.contentUrl),
    baseline: baseline
      ? {
          sampleSize: baseline.sampleSize,
          avgViews: baseline.avgViews,
          avgLikes: baseline.avgLikes,
          avgComments: baseline.avgComments,
          avgEngagementRate: baseline.avgEngagementRate,
          followerCount: baseline.followerCount,
          audienceIndiaPct: baseline.audienceIndiaPct,
          trustScore: creatorProfile?.reputationScore ?? null,
        }
      : null,
    baselineComparison,
    tracking,
  };
}

async function buildSubmissionAnalysis(userId: string, submissionId: string) {
  const [creatorProfile, tracking] = await Promise.all([
    prisma.creatorProfile.findUnique({
      where: { userId },
      select: { id: true, reputationScore: true },
    }),
    getSubmissionTracking(userId, submissionId),
  ]);

  const baseline = creatorProfile
    ? await prisma.creatorBaseline.findUnique({
        where: {
          creatorId_platform: {
            creatorId: creatorProfile.id,
            platform: tracking.submission.platform,
          },
        },
      })
    : null;

  const latestSnapshot = tracking.summary.latestSnapshot;
  const baselineComparison = baseline && latestSnapshot
    ? {
        baselineAvgViews: baseline.avgViews,
        baselineAvgEngagementRate: baseline.avgEngagementRate,
        currentViews: latestSnapshot.viewCount,
        currentEngagementRatio: latestSnapshot.engagementRatio,
        viewVsBaselineRatio: baseline.avgViews > 0 ? Number((latestSnapshot.viewCount / baseline.avgViews).toFixed(4)) : null,
        engagementDeltaVsBaseline:
          latestSnapshot.engagementRatio === null
            ? null
            : Number((latestSnapshot.engagementRatio - baseline.avgEngagementRate).toFixed(6)),
      }
    : null;

  return {
    platform: tracking.submission.platform,
    contentReference: tracking.submission.platform === Platform.YOUTUBE
      ? extractYouTubeVideoId(tracking.submission.contentUrl)
      : extractInstagramShortcode(tracking.submission.contentUrl),
    baseline: baseline
      ? {
          sampleSize: baseline.sampleSize,
          avgViews: baseline.avgViews,
          avgLikes: baseline.avgLikes,
          avgComments: baseline.avgComments,
          avgEngagementRate: baseline.avgEngagementRate,
          followerCount: baseline.followerCount,
          audienceIndiaPct: baseline.audienceIndiaPct,
          trustScore: creatorProfile?.reputationScore ?? null,
        }
      : null,
    baselineComparison,
    tracking,
  };
}

const page = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benchmrk Dev Phase 2</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .wrap { max-width: 1180px; margin: 0 auto; padding: 32px 20px 48px; }
      h1 { margin: 0 0 8px; font-size: 32px; }
      p { color: #94a3b8; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 24px; }
      .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
      .card h2 { margin-top: 0; font-size: 18px; }
      label { display: block; margin: 12px 0 6px; font-size: 14px; color: #cbd5e1; }
      input, textarea, select, button { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #334155; background: #020617; color: #e2e8f0; padding: 10px 12px; font: inherit; }
      textarea { min-height: 120px; resize: vertical; }
      button { background: #2563eb; border: none; cursor: pointer; font-weight: 600; margin-top: 12px; }
      button:hover { background: #1d4ed8; }
      .secondary { background: #334155; }
      .secondary:hover { background: #475569; }
      .wide { margin-top: 20px; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .status { font-size: 12px; color: #93c5fd; margin-top: 8px; }
      .hint { font-size: 12px; color: #cbd5e1; margin-top: 8px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 14px; min-height: 180px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Benchmrk Dev Phase 2</h1>
      <p>Use this page to create LIVE brand campaigns, let the creator pick a campaign and submit a YouTube video, and then wait for the admin sweep threshold. Production sweep eligibility is 7 days; testing uses 10 minutes.</p>

      <section class="card wide">
        <h2>Fast Test Flow</h2>
        <p>1. Wait for the dev creator + dev brand session to boot.</p>
        <p>2. Create a campaign with budget, dollars per 1000 views, and a per-video cap.</p>
        <p>3. Refresh campaigns and choose one in the creator submission form.</p>
        <p>4. Submit a real YouTube or Instagram URL and capture extra snapshots with Track Submission Now Again.</p>
        <p>5. After 10 minutes from campaign start, run the admin sweep in the admin console.</p>
        <div class="status" id="boot-status">Booting dev creator and brand sessions...</div>
      </section>

      <div class="grid">
        <section class="card">
          <h2>1. Brand Campaign Setup</h2>
          <label>Campaign Title</label>
          <input id="campaign-title" value="Benchmrk Dev Campaign" />
          <label>Description</label>
          <textarea id="campaign-description">Dev campaign for testing brand creation, creator submission, and admin review sweeps.</textarea>
          <label>Guidelines</label>
          <textarea id="campaign-guidelines">Submit one live YouTube video. Keep content public and trackable.</textarea>
          <div class="row">
            <div>
              <label>$ per 1000 views</label>
              <input id="campaign-rate-per-1000" type="number" min="0" step="0.01" value="500" />
            </div>
            <div>
              <label>Campaign Budget</label>
              <input id="campaign-budget" type="number" min="0" step="0.01" value="5000" />
            </div>
          </div>
          <label>Minimum Incremental Views Per Sweep For Payment Eligibility</label>
          <input id="campaign-min-views" type="number" min="0" step="1" value="1000" />
          <label>Per Video Cap</label>
          <input id="campaign-video-cap" type="number" min="0" step="0.01" value="250" />
          <button id="campaign-create-btn">Create LIVE Campaign</button>
          <button id="campaign-refresh-btn" class="secondary">Refresh Campaigns</button>
          <div class="hint">Campaigns created here go LIVE immediately for dev testing and become sweep-eligible after 10 minutes.</div>
        </section>

        <section class="card">
          <h2>2. Campaign Selection</h2>
          <label>Available LIVE Campaigns</label>
          <select id="campaign-select"></select>
          <div class="hint" id="campaign-selection-hint">Loading campaigns...</div>
        </section>

        <section class="card">
          <h2>3. YouTube Connection</h2>
          <p>Optional for this tester. Public YouTube URLs can still be analyzed without connecting.</p>
          <button id="youtube-connect-btn">Connect YouTube Account</button>
        </section>

        <section class="card">
          <h2>4. YouTube Trust Score Baseline</h2>
          <div class="row">
            <div>
              <label>Account Age Days</label>
              <input id="account-age-days" type="number" value="420" />
            </div>
            <div>
              <label>Follower Count</label>
              <input id="follower-count" type="number" value="18000" />
            </div>
          </div>
          <label>Audience India %</label>
          <input id="audience-india-pct" type="number" value="72" />
          <label>Posts JSON</label>
          <textarea id="posts-json">[
  {"views": 21000, "likes": 820, "comments": 90},
  {"views": 18500, "likes": 760, "comments": 82},
  {"views": 24000, "likes": 950, "comments": 105},
  {"views": 19800, "likes": 790, "comments": 88},
  {"views": 22300, "likes": 870, "comments": 96}
]</textarea>
          <button id="baseline-rebuild-btn">Rebuild YouTube Baseline</button>
          <button id="baseline-fetch-btn" class="secondary">Fetch Saved YouTube Baseline</button>
        </section>

        <section class="card">
          <h2>5. Connected / Live YouTube Baseline</h2>
          <label>Channel URL / @handle</label>
          <input id="youtube-channel-input" value="@YouTubeCreators" />
          <label>Videos To Sample</label>
          <input id="youtube-max-results" type="number" min="1" max="30" value="10" />
          <button id="youtube-live-btn">Fetch Live YouTube Baseline</button>
          <button id="youtube-connected-baseline-btn" class="secondary">Baseline From Connected YouTube</button>
        </section>

        <section class="card">
          <h2>6. Submit Link For Analysis</h2>
          <label>Campaign For Submission</label>
          <select id="youtube-campaign-select"></select>
          <label>Platform</label>
          <select id="submission-platform">
            <option value="YOUTUBE">YouTube</option>
            <option value="INSTAGRAM">Instagram</option>
          </select>
          <label>Content URL</label>
          <input id="youtube-url" placeholder="https://youtube.com/watch?v=... or https://instagram.com/reel/..." />
          <button id="youtube-submit-btn">Submit Link For Analysis</button>
          <button id="youtube-list-btn" class="secondary">List My Old Submissions</button>
          <label>Current Submission ID</label>
          <input id="submission-id" placeholder="auto-filled after submit" />
          <button id="youtube-fetch-btn">Fetch Submission Analysis</button>
          <button id="youtube-track-now-btn">Track Submission Now Again</button>
          <button id="youtube-stop-btn" class="secondary">Stop Video Analysis</button>
        </section>
      </div>

      <section class="card wide">
        <h2>Response</h2>
        <div class="status" id="status"></div>
        <pre id="summary"></pre>
        <pre id="output"></pre>
      </section>
    </div>

    <script>
      const output = document.getElementById('output');
      const summary = document.getElementById('summary');
      const status = document.getElementById('status');
      const bootStatus = document.getElementById('boot-status');
      const submissionIdInput = document.getElementById('submission-id');
      const campaignSelect = document.getElementById('campaign-select');
      const youtubeCampaignSelect = document.getElementById('youtube-campaign-select');
      const submissionPlatformSelect = document.getElementById('submission-platform');
      const campaignSelectionHint = document.getElementById('campaign-selection-hint');
      let creatorToken = '';
      let brandToken = '';

      async function resolvePreferredCreatorToken(fallbackToken) {
        const portalToken = localStorage.getItem('creatorPortalToken') || '';
        if (!portalToken) {
          return {
            token: fallbackToken,
            source: 'dev',
            email: null,
          };
        }

        try {
          const session = await api('/creator/app/session', {}, portalToken);
          return {
            token: portalToken,
            source: 'portal',
            email: session?.user?.email || null,
          };
        } catch {
          localStorage.removeItem('creatorPortalToken');
          return {
            token: fallbackToken,
            source: 'dev',
            email: null,
          };
        }
      }

      function formatNumber(value) {
        if (typeof value === 'number') return value.toLocaleString();
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric.toLocaleString() : '—';
      }

      function formatDecimal(value, digits = 4) {
        return typeof value === 'number' ? value.toFixed(digits) : Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';
      }

      function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
      }

      function summarizeAnalysis(result) {
        const analysis = result?.analysis;
        const tracking = analysis?.tracking;
        const submission = tracking?.submission;
        const summaryData = tracking?.summary;
        const reviewSignals = tracking?.reviewSignals;
        const baseline = analysis?.baseline;
        const baselineComparison = analysis?.baselineComparison;
        const snapshots = tracking?.snapshots || [];
        const latestSnapshot = summaryData?.latestSnapshot;
        const nextCheckpoint = summaryData?.nextPendingCheckpoint;

        if (!analysis || !submission || !summaryData) {
          return '';
        }

        const lines = [
          'SUBMISSION OVERVIEW',
          'Submission ID: ' + (submission.id || '—'),
          'Campaign: ' + (submission.campaign?.title || '—'),
          'Platform: ' + (analysis.platform || submission.platform || '—'),
          'Content Reference: ' + (analysis.contentReference || '—'),
          'URL: ' + (submission.contentUrl || '—'),
          'Status: ' + (submission.status || '—'),
          'Created At: ' + formatDate(submission.createdAt),
          'Last Checked At: ' + formatDate(submission.lastCheckedAt),
          'Analysis Stopped At: ' + formatDate(submission.analysisStoppedAt),
          '',
          'LATEST SNAPSHOT',
          'Views: ' + formatNumber(latestSnapshot?.viewCount),
          'Likes: ' + formatNumber(latestSnapshot?.likeCount),
          'Comments: ' + formatNumber(latestSnapshot?.commentCount),
          'Engagement Ratio: ' + formatDecimal(latestSnapshot?.engagementRatio, 6),
          'Snapshots Captured: ' + formatNumber(summaryData.totalSnapshots),
          'Growth Pattern: ' + (summaryData.growthPattern || '—'),
          'Tracking State: ' + (summaryData?.trackingState || '—'),
          'Estimated Current Value: ' + formatNumber(submission.estimatedCurrentValue),
          '',
          'ADMIN REVIEW SIGNAL',
          'Signal Level: ' + (reviewSignals?.signalLevel || '—'),
          'Analysis Stopped: ' + (reviewSignals?.analysisStopped ? 'YES' : 'NO'),
          'Has Pending Checkpoints: ' + (reviewSignals?.hasPendingCheckpoints ? 'YES' : 'NO'),
          'Risk Score: ' + formatNumber(reviewSignals?.riskScore),
          'Confidence Score: ' + formatNumber(reviewSignals?.confidenceScore),
          'Completed Checkpoints: ' + formatNumber(reviewSignals?.completedCheckpoints) + ' / ' + formatNumber(reviewSignals?.totalCheckpoints),
          '',
          'BASELINE COMPARISON',
          'Trust Score: ' + formatNumber(baseline?.trustScore),
          'Baseline Avg Views: ' + formatNumber(baseline?.avgViews),
          'Baseline Avg Engagement: ' + formatDecimal(baseline?.avgEngagementRate, 6),
          'Views vs Baseline Ratio: ' + formatDecimal(baselineComparison?.viewVsBaselineRatio, 4),
          'Engagement Delta vs Baseline: ' + formatDecimal(baselineComparison?.engagementDeltaVsBaseline, 6),
          '',
          'NEXT CHECKPOINT',
          'Label: ' + (nextCheckpoint?.checkpointLabel || '—'),
          'Scheduled For: ' + formatDate(nextCheckpoint?.scheduledFor),
          '',
          'RECENT GROWTH',
        ];

        const recentGrowth = (summaryData.growthTimeline || []).slice(-3);
        if (recentGrowth.length === 0) {
          lines.push('No growth deltas yet. Capture another snapshot to compare movement over time.');
        } else {
          recentGrowth.forEach((item, index) => {
            lines.push(
              (index + 1) + '. ' + formatDate(item.fromCapturedAt) + ' -> ' + formatDate(item.toCapturedAt) + ' | ΔViews=' + formatNumber(item.deltaViews) + ' | ΔHours=' + formatDecimal(item.deltaHours, 2) + ' | Velocity/hr=' + formatDecimal(item.velocityPerHour, 2)
            );
          });
        }

        if (snapshots.length > 0) {
          lines.push('', 'SNAPSHOT HISTORY');
          snapshots.slice(-5).forEach((snapshot, index) => {
            lines.push(
              (index + 1) + '. ' + formatDate(snapshot.capturedAt) + ' | Views=' + formatNumber(snapshot.viewCount) + ' | Likes=' + formatNumber(snapshot.likeCount) + ' | Comments=' + formatNumber(snapshot.commentCount) + ' | ER=' + formatDecimal(snapshot.engagementRatio, 6)
            );
          });
        }

        if (Array.isArray(reviewSignals?.reasons) && reviewSignals.reasons.length > 0) {
          lines.push('', 'ADMIN REVIEW NOTES');
          reviewSignals.reasons.forEach((reason, index) => {
            lines.push((index + 1) + '. ' + reason);
          });
        }

        if (Array.isArray(reviewSignals?.positiveSignals) && reviewSignals.positiveSignals.length > 0) {
          lines.push('', 'POSITIVE SIGNALS');
          reviewSignals.positiveSignals.forEach((reason, index) => {
            lines.push((index + 1) + '. ' + reason);
          });
        }

        if (Array.isArray(reviewSignals?.concerns) && reviewSignals.concerns.length > 0) {
          lines.push('', 'CONCERNS');
          reviewSignals.concerns.forEach((reason, index) => {
            lines.push((index + 1) + '. ' + reason);
          });
        }

        return lines.join('\n');
      }

      function summarizeRunDue(result) {
        const runDue = result?.result;
        if (!runDue) return '';

        const lines = [
          'DUE CHECKS RUN',
          'Completed: ' + formatNumber(runDue.processedCount),
          'Failed: ' + formatNumber(runDue.failedCount),
          'Skipped: ' + formatNumber(runDue.skippedCount),
          '',
          'JOB RESULTS',
        ];

        const jobs = runDue.results || [];
        if (jobs.length === 0) {
          lines.push('No due jobs were available.');
        } else {
          jobs.forEach((job, index) => {
            lines.push(
              (index + 1) + '. ' + (job.checkpointLabel || '—') + ' | Submission=' + (job.submissionId || '—') + ' | Status=' + (job.status || '—') + (job.error ? ' | Error=' + job.error : '')
            );
          });
        }

        return lines.join('\n');
      }

      function summarizeSubmissionList(result) {
        const submissions = Array.isArray(result) ? result : result?.submissions;
        if (!Array.isArray(submissions)) return '';

        const lines = [
          'OLD SUBMISSIONS',
          'Count: ' + formatNumber(submissions.length),
          '',
        ];

        if (submissions.length === 0) {
          lines.push('No submissions found yet.');
          return lines.join('\n');
        }

        submissions.forEach((submission, index) => {
          lines.push(
            (index + 1) + '. ID=' + (submission.id || '—') + ' | Platform=' + (submission.platform || '—') + ' | Campaign=' + (submission.campaign?.title || '—') + ' | Created=' + formatDate(submission.createdAt) + ' | Last Checked=' + formatDate(submission.lastCheckedAt) + ' | Status=' + (submission.status || '—') + ' | URL=' + (submission.contentUrl || '—')
          );
        });

        return lines.join('\n');
      }

      function summarizeBaseline(result) {
        if (result?.baseline && result?.trustScore !== undefined) {
          return [
            'BASELINE REBUILT',
            'Platform: ' + (result.baseline.platform || '—'),
            'Sample Size: ' + formatNumber(result.baseline.sampleSize),
            'Average Views: ' + formatNumber(result.baseline.avgViews),
            'Average Likes: ' + formatNumber(result.baseline.avgLikes),
            'Average Comments: ' + formatNumber(result.baseline.avgComments),
            'Average Engagement: ' + formatDecimal(result.baseline.avgEngagementRate, 6),
            'Trust Score: ' + formatNumber(result.trustScore),
            'Trust Tier: ' + (result.trustTier || '—'),
            'Consistency Score: ' + formatDecimal(result.consistencyScore, 4),
          ].join('\n');
        }

        if (result?.platform && result?.avgViews !== undefined) {
          return [
            'SAVED BASELINE',
            'Platform: ' + (result.platform || '—'),
            'Sample Size: ' + formatNumber(result.sampleSize),
            'Average Views: ' + formatNumber(result.avgViews),
            'Average Likes: ' + formatNumber(result.avgLikes),
            'Average Comments: ' + formatNumber(result.avgComments),
            'Average Engagement: ' + formatDecimal(result.avgEngagementRate, 6),
            'Follower Count: ' + formatNumber(result.followerCount),
            'Audience India %: ' + formatNumber(result.audienceIndiaPct),
            'Computed At: ' + formatDate(result.computedAt),
          ].join('\n');
        }

        return '';
      }

      function summarizeCampaignList(result) {
        const campaigns = Array.isArray(result) ? result : result?.campaigns;
        if (!Array.isArray(campaigns)) return '';

        const lines = [
          'LIVE CAMPAIGNS',
          'Count: ' + formatNumber(campaigns.length),
          '',
        ];

        if (campaigns.length === 0) {
          lines.push('No LIVE campaigns yet. Create one from the Brand Campaign Setup card.');
          return lines.join('\n');
        }

        campaigns.forEach((campaign, index) => {
          lines.push(
            (index + 1) + '. ' + (campaign.title || '—') + ' | $/1000 Views=' + formatDecimal(campaign.dollarsPerThousandViews, 2) + ' | Budget=' + formatDecimal(campaign.totalBudget, 2) + ' | Min Incremental Views=' + formatNumber(campaign.minimumPayoutViews) + ' | Cap=' + formatDecimal(campaign.maxPayoutPerSubmission, 2) + ' | Sweep Eligible=' + (campaign.isSweepEligible ? 'YES' : 'NO') + ' | Starts=' + formatDate(campaign.startDate)
          );
        });

        return lines.join('\n');
      }

      function summarizeCampaignCreate(result) {
        const campaign = result?.campaign;
        if (!campaign) return '';
        return [
          'CAMPAIGN CREATED',
          'Campaign ID: ' + (campaign.id || '—'),
          'Title: ' + (campaign.title || '—'),
          '$ per 1000 Views: ' + formatDecimal(campaign.dollarsPerThousandViews, 2),
          'Budget: ' + formatDecimal(campaign.totalBudget, 2),
          'Minimum Incremental Views Per Sweep: ' + formatNumber(campaign.minimumPayoutViews),
          'Per Video Cap: ' + formatDecimal(campaign.maxPayoutPerSubmission, 2),
          'Sweep Eligible At: ' + formatDate(campaign.sweepEligibleAt),
        ].join('\n');
      }

      function buildSummary(result, meta) {
        if (meta.includes('/dev/phase2/bootstrap')) {
          return [
            'DEV SESSION READY',
            'Creator: ' + (result?.creatorUser?.email || '—'),
            'Brand: ' + (result?.brandUser?.email || '—'),
            'This page now uses both a hidden creator account and a hidden brand account.',
          ].join('\n');
        }

        if (meta.includes('/dev/phase2/brand/campaigns')) {
          return summarizeCampaignCreate(result);
        }

        if (meta.includes('/dev/phase2/campaigns')) {
          return summarizeCampaignList(result);
        }

        if (meta.includes('/dev/phase2/submissions') && !meta.includes('/submissions-list') || meta.includes('/dev/phase2/youtube/submit')) {
          const analysisSummary = summarizeAnalysis(result);
          return analysisSummary || '';
        }

        if (meta.includes('/track-now')) {
          return summarizeAnalysis(result);
        }

        if (meta.includes('/dev/phase2/youtube/run-due')) {
          return summarizeRunDue(result);
        }

        if (meta.includes('/dev/phase2/submissions-list') || meta.includes('/dev/phase2/youtube/submissions-list')) {
          return summarizeSubmissionList(result);
        }

        if (meta.includes('/creators/baseline')) {
          return summarizeBaseline(result);
        }

        if (meta.includes('/auth/youtube/start')) {
          return [
            'YOUTUBE CONNECT STARTED',
            'A popup should open for Google OAuth.',
            'If nothing opens, allow popups and try again.',
          ].join('\n');
        }

        return '';
      }

      function render(result, meta) {
        status.textContent = meta;
        summary.textContent = buildSummary(result, meta);
        output.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      }

      async function api(path, options = {}, token = creatorToken) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (token) headers.Authorization = 'Bearer ' + token;

        const response = await fetch(path, { ...options, headers });
        const text = await response.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
        render(data, (options.method || 'GET') + ' ' + path + ' -> ' + response.status);
        if (!response.ok) throw new Error(data?.error || 'Request failed');
        return data;
      }

      function setCampaignOptions(campaigns) {
        const optionsHtml = Array.isArray(campaigns) && campaigns.length > 0
          ? campaigns.map((campaign) => '<option value="' + campaign.id + '">' + campaign.title + ' | $/1000=' + Number(campaign.dollarsPerThousandViews || 0).toFixed(2) + ' | Sweep ' + (campaign.isSweepEligible ? 'READY' : 'PENDING') + '</option>').join('\n')
          : '<option value="">No LIVE campaigns yet</option>';

        campaignSelect.innerHTML = optionsHtml;
        youtubeCampaignSelect.innerHTML = optionsHtml;
        campaignSelectionHint.textContent = Array.isArray(campaigns) && campaigns.length > 0
          ? 'Choose a campaign below. Creator submissions will be attached to the selected campaign.'
          : 'Create a LIVE campaign first.';
      }

      async function loadCampaigns() {
        const data = await api('/dev/phase2/campaigns');
        setCampaignOptions(Array.isArray(data?.campaigns) ? data.campaigns : []);
        return data;
      }

      async function bootstrap() {
        bootStatus.textContent = 'Booting dev creator and brand sessions...';
        const data = await api('/dev/phase2/bootstrap', {
          method: 'POST',
          body: JSON.stringify({}),
        }, '');
        const preferredCreator = await resolvePreferredCreatorToken(data.creatorToken);
        creatorToken = preferredCreator.token;
        brandToken = data.brandToken;
        bootStatus.textContent = preferredCreator.source === 'portal'
          ? 'Ready: using creator portal session ' + (preferredCreator.email || 'creator account') + ' and dev brand ' + data.brandUser.email
          : 'Ready: ' + data.creatorUser.email + ' and ' + data.brandUser.email;
        await loadCampaigns();
      }

      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'youtube-connect-result') {
          render(event.data.payload, 'YOUTUBE OAUTH RESULT');
        }
      });

      document.getElementById('campaign-create-btn').onclick = async () => {
        const data = await api('/dev/phase2/brand/campaigns', {
          method: 'POST',
          body: JSON.stringify({
            title: document.getElementById('campaign-title').value,
            description: document.getElementById('campaign-description').value,
            guidelines: document.getElementById('campaign-guidelines').value,
            dollarsPerThousandViews: Number(document.getElementById('campaign-rate-per-1000').value),
            totalBudget: Number(document.getElementById('campaign-budget').value),
            minimumPayoutViews: Number(document.getElementById('campaign-min-views').value),
            maxPayoutPerSubmission: Number(document.getElementById('campaign-video-cap').value),
          }),
        }, brandToken);
        await loadCampaigns();
        if (data?.campaign?.id) {
          campaignSelect.value = data.campaign.id;
          youtubeCampaignSelect.value = data.campaign.id;
        }
      };

      document.getElementById('campaign-refresh-btn').onclick = async () => {
        await loadCampaigns();
      };

      document.getElementById('youtube-connect-btn').onclick = async () => {
        const data = await api('/auth/youtube/start');
        const popup = window.open(data.authUrl, 'youtube-oauth', 'width=520,height=720');
        if (!popup) {
          render({ error: 'Popup blocked. Allow popups for localhost and try again.' }, 'YOUTUBE OAUTH');
        }
      };

      document.getElementById('baseline-rebuild-btn').onclick = async () => {
        const posts = JSON.parse(document.getElementById('posts-json').value);
        await api('/creators/baseline/rebuild', {
          method: 'POST',
          body: JSON.stringify({
            platform: 'YOUTUBE',
            accountAgeDays: Number(document.getElementById('account-age-days').value),
            followerCount: Number(document.getElementById('follower-count').value),
            audienceIndiaPct: Number(document.getElementById('audience-india-pct').value),
            posts,
          }),
        });
      };

      document.getElementById('baseline-fetch-btn').onclick = async () => {
        await api('/creators/baseline?platform=YOUTUBE');
      };

      document.getElementById('youtube-live-btn').onclick = async () => {
        await api('/creators/baseline/rebuild/youtube-live', {
          method: 'POST',
          body: JSON.stringify({
            channelInput: document.getElementById('youtube-channel-input').value,
            maxResults: Number(document.getElementById('youtube-max-results').value),
          }),
        });
      };

      document.getElementById('youtube-connected-baseline-btn').onclick = async () => {
        await api('/creators/baseline/rebuild/youtube-connected', {
          method: 'POST',
          body: JSON.stringify({
            maxResults: Number(document.getElementById('youtube-max-results').value),
          }),
        });
      };

      document.getElementById('youtube-submit-btn').onclick = async () => {
        const data = await api('/dev/phase2/submissions', {
          method: 'POST',
          body: JSON.stringify({
            campaignId: youtubeCampaignSelect.value,
            platform: submissionPlatformSelect.value,
            contentUrl: document.getElementById('youtube-url').value,
          }),
        });
        if (data?.submissionId) {
          submissionIdInput.value = data.submissionId;
        }
      };

      document.getElementById('youtube-list-btn').onclick = async () => {
        const data = await api('/dev/phase2/submissions-list');
        const submissions = Array.isArray(data?.submissions) ? data.submissions : [];
        if (submissions[0]?.id) {
          submissionIdInput.value = submissions[0].id;
        }
      };

      document.getElementById('youtube-fetch-btn').onclick = async () => {
        const submissionId = submissionIdInput.value.trim();
        await api('/dev/phase2/submissions/' + encodeURIComponent(submissionId));
      };

      document.getElementById('youtube-track-now-btn').onclick = async () => {
        const submissionId = submissionIdInput.value.trim();
        await api('/dev/phase2/submissions/' + encodeURIComponent(submissionId) + '/track-now', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      };

      document.getElementById('youtube-stop-btn').onclick = async () => {
        const submissionId = submissionIdInput.value.trim();
        await api('/dev/phase2/submissions/' + encodeURIComponent(submissionId) + '/stop-analysis', {
          method: 'POST',
          body: JSON.stringify({}),
        });
      };

      bootstrap().catch((error) => {
        bootStatus.textContent = 'Failed to boot dev session';
        render({ error: error.message }, 'BOOTSTRAP');
      });
    </script>
  </body>
</html>`;

function serializeCampaignForDev(campaign: any, now = new Date()) {
  const dollarsPerThousandViews = Number(campaign.cpvRate ?? 0) * 1000;
  const sweepEligibleAt = new Date(new Date(campaign.startDate).getTime() + (process.env.NODE_ENV === 'production' ? 7 * 24 * 60 * 60 * 1000 : 10 * 60 * 1000));
  return {
    id: campaign.id,
    title: campaign.title,
    description: campaign.description,
    guidelines: campaign.guidelines,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    totalBudget: Number(campaign.totalBudget ?? 0),
    minimumPayoutViews: Number(campaign.minimumPayoutViews ?? 0),
    maxPayoutPerSubmission: Number(campaign.maxPayoutPerSubmission ?? 0),
    dollarsPerThousandViews,
    cpvRate: Number(campaign.cpvRate ?? 0),
    isSweepEligible: now.getTime() >= sweepEligibleAt.getTime(),
    sweepEligibleAt,
  };
}

export async function baselineDevRoutes(app: FastifyInstance) {
  app.get('/dev/phase2', async (_request, reply) => {
    return reply.type('text/html').send(page);
  });

  app.post('/dev/phase2/bootstrap', async (_request, reply) => {
    try {
      const [{ user: creatorUser }, { user: brandUser }] = await Promise.all([
        ensureDevCreator(),
        ensureDevBrand(),
      ]);
      const creatorToken = jwt.sign({ userId: creatorUser.id, role: 'CREATOR' }, JWT_SECRET, { expiresIn: '7d' });
      const brandToken = jwt.sign({ userId: brandUser.id, role: 'BRAND' }, JWT_SECRET, { expiresIn: '7d' });

      return reply.send({
        ok: true,
        creatorToken,
        brandToken,
        creatorUser: {
          id: creatorUser.id,
          email: creatorUser.email,
          role: creatorUser.role,
        },
        brandUser: {
          id: brandUser.id,
          email: brandUser.email,
          role: brandUser.role,
        },
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/dev/phase2/submissions-list', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const submissions = await getMySubmissions(request.user.userId);
      return reply.send({ ok: true, submissions });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/dev/phase2/submissions/:submissionId', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      const analysis = await buildSubmissionAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/submissions/:submissionId/track-now', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      await trackSubmissionNow(request.user.userId, submissionId);
      const analysis = await buildSubmissionAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/submissions/:submissionId/stop-analysis', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      const tracking = await stopSubmissionAnalysis(request.user.userId, submissionId);
      const analysis = await buildSubmissionAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, tracking, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/dev/phase2/campaigns', { preHandler: authenticate }, async (_request: any, reply) => {
    try {
      const now = new Date();
      const campaigns = await prisma.campaign.findMany({
        where: {
          status: 'LIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        ok: true,
        campaigns: campaigns.map((campaign) => serializeCampaignForDev(campaign, now)),
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/brand/campaigns', { preHandler: authenticate }, async (request: any, reply) => {
    if (request.user?.role !== 'BRAND') {
      return reply.code(403).send({ error: 'Only brands can create campaigns on this route' });
    }

    const body = request.body as {
      title?: string;
      description?: string;
      guidelines?: string;
      dollarsPerThousandViews?: number;
      totalBudget?: number;
      minimumPayoutViews?: number;
      maxPayoutPerSubmission?: number;
    };

    if (!body.title?.trim()) {
      return reply.code(400).send({ error: 'title is required' });
    }
    if (!Number.isFinite(Number(body.dollarsPerThousandViews)) || Number(body.dollarsPerThousandViews) < 0) {
      return reply.code(400).send({ error: 'dollarsPerThousandViews must be a valid non-negative number' });
    }
    if (!Number.isFinite(Number(body.totalBudget)) || Number(body.totalBudget) < 0) {
      return reply.code(400).send({ error: 'totalBudget must be a valid non-negative number' });
    }
    if (!Number.isFinite(Number(body.minimumPayoutViews)) || Number(body.minimumPayoutViews) < 0) {
      return reply.code(400).send({ error: 'minimumPayoutViews must be a valid non-negative number' });
    }
    if (!Number.isFinite(Number(body.maxPayoutPerSubmission)) || Number(body.maxPayoutPerSubmission) < 0) {
      return reply.code(400).send({ error: 'maxPayoutPerSubmission must be a valid non-negative number' });
    }

    try {
      const [{ brandProfile }, { creatorProfile }] = await Promise.all([
        ensureDevBrand(),
        ensureDevCreator(),
      ]);

      const now = new Date();
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const campaign = await (prisma.campaign as any).create({
        data: {
          brandId: brandProfile.id,
          title: body.title.trim(),
          description: body.description?.trim() || 'Dev campaign created from /dev/phase2',
          guidelines: body.guidelines?.trim() || 'Submit a live public YouTube video.',
          cpvRate: Number(body.dollarsPerThousandViews) / 1000,
          totalBudget: Number(body.totalBudget),
          minimumPayoutViews: Number(body.minimumPayoutViews),
          maxPayoutPerSubmission: Number(body.maxPayoutPerSubmission),
          status: 'LIVE',
          startDate: now,
          endDate,
        },
      });

      await prisma.application.upsert({
        where: {
          campaignId_creatorId: {
            campaignId: campaign.id,
            creatorId: creatorProfile.id,
          },
        },
        update: { status: 'ACCEPTED' },
        create: {
          campaignId: campaign.id,
          creatorId: creatorProfile.id,
          status: 'ACCEPTED',
        },
      });

      return reply.send({ ok: true, campaign: serializeCampaignForDev(campaign, now) });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/youtube/submit', { preHandler: authenticate }, async (request: any, reply) => {
    const { campaignId, contentUrl } = request.body as { campaignId?: string; contentUrl?: string };

    if (!campaignId || !campaignId.trim()) {
      return reply.code(400).send({ error: 'campaignId is required' });
    }
    if (!contentUrl || !contentUrl.trim()) {
      return reply.code(400).send({ error: 'contentUrl is required' });
    }
    if (!extractYouTubeVideoId(contentUrl)) {
      return reply.code(400).send({ error: 'A valid YouTube video URL is required' });
    }

    try {
      await ensureDevCreator();
      await ensureCreatorAcceptedForCampaign(request.user.userId, campaignId);
      const submission = await submitContent(request.user.userId, campaignId, 'YOUTUBE', contentUrl);
      await trackSubmissionNow(request.user.userId, submission.id);
      const analysis = await buildYouTubeAnalysis(request.user.userId, submission.id);

      return reply.send({
        ok: true,
        submissionId: submission.id,
        analysis,
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/submissions', { preHandler: authenticate }, async (request: any, reply) => {
    const { campaignId, platform, contentUrl } = request.body as { campaignId?: string; platform?: Platform; contentUrl?: string };

    if (!campaignId || !campaignId.trim()) {
      return reply.code(400).send({ error: 'campaignId is required' });
    }
    if (!platform || !Object.values(Platform).includes(platform)) {
      return reply.code(400).send({ error: 'platform must be YOUTUBE or INSTAGRAM' });
    }
    if (!contentUrl || !contentUrl.trim()) {
      return reply.code(400).send({ error: 'contentUrl is required' });
    }
    if (platform === Platform.YOUTUBE && !extractYouTubeVideoId(contentUrl)) {
      return reply.code(400).send({ error: 'A valid YouTube video URL is required' });
    }
    if (platform === Platform.INSTAGRAM && !extractInstagramShortcode(contentUrl)) {
      return reply.code(400).send({ error: 'A valid Instagram reel/post URL is required' });
    }

    try {
      await ensureDevCreator();
      await ensureCreatorAcceptedForCampaign(request.user.userId, campaignId);
      const submission = await submitContent(request.user.userId, campaignId, platform, contentUrl);
      await trackSubmissionNow(request.user.userId, submission.id);
      const analysis = await buildSubmissionAnalysis(request.user.userId, submission.id);

      return reply.send({
        ok: true,
        submissionId: submission.id,
        analysis,
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/dev/phase2/youtube/submissions-list', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const submissions = await getMySubmissions(request.user.userId);
      const youtubeOnly = submissions.filter((submission) => submission.platform === 'YOUTUBE');
      return reply.send({ ok: true, submissions: youtubeOnly });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/dev/phase2/youtube/submissions/:submissionId', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      const analysis = await buildYouTubeAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/youtube/submissions/:submissionId/track-now', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      await trackSubmissionNow(request.user.userId, submissionId);
      const analysis = await buildYouTubeAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/youtube/submissions/:submissionId/stop-analysis', { preHandler: authenticate }, async (request: any, reply) => {
    const { submissionId } = request.params as { submissionId: string };

    try {
      const tracking = await stopSubmissionAnalysis(request.user.userId, submissionId);
      const analysis = await buildYouTubeAnalysis(request.user.userId, submissionId);
      return reply.send({ ok: true, submissionId, tracking, analysis });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/dev/phase2/youtube/run-due', { preHandler: authenticate }, async (request: any, reply) => {
    try {
      const result = await processDueTrackingJobs({ userId: request.user.userId, maxJobs: 10 });
      return reply.send({ ok: true, result });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
