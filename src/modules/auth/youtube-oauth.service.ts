import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type OAuthStatePayload = {
  purpose: 'youtube_connect';
  userId: string;
  nonce: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type ConnectedYouTubeChannel = {
  channelId: string;
  channelTitle: string | null;
  publishedAt: string | null;
  subscriberCount: number;
  uploadsPlaylistId: string | null;
};

type YouTubeMineResponse = {
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

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseCount(value?: string) {
  const parsed = Number(value ?? '0');
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.round(parsed);
}

async function persistConnectedYouTubeChannels(input: {
  userId: string;
  channels: ConnectedYouTubeChannel[];
  accessToken: string;
  refreshToken?: string;
  scopes?: string;
  tokenType?: string;
  expiresIn?: number;
}) {
  await prisma.connectedPlatformAccount.updateMany({
    where: {
      userId: input.userId,
      platform: Platform.YOUTUBE,
    },
    data: {
      isPrimary: false,
    },
  });

  const existingAccounts = await prisma.connectedPlatformAccount.findMany({
    where: {
      platform: Platform.YOUTUBE,
      providerAccountId: {
        in: input.channels.map((channel) => channel.channelId),
      },
    },
  });

  const existingByChannelId = new Map(existingAccounts.map((account) => [account.providerAccountId, account]));
  const tokenExpiresAt = input.expiresIn === undefined ? null : new Date(Date.now() + input.expiresIn * 1000);

  const storedChannels = await Promise.all(
    input.channels.map((channel, index) => {
      const existing = existingByChannelId.get(channel.channelId);

      return prisma.connectedPlatformAccount.upsert({
        where: {
          platform_providerAccountId: {
            platform: Platform.YOUTUBE,
            providerAccountId: channel.channelId,
          },
        },
        update: {
          userId: input.userId,
          channelTitle: channel.channelTitle,
          publishedAt: channel.publishedAt === null ? null : new Date(channel.publishedAt),
          subscriberCount: channel.subscriberCount,
          uploadsPlaylistId: channel.uploadsPlaylistId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? existing?.refreshToken ?? null,
          scopes: input.scopes ?? null,
          tokenType: input.tokenType ?? null,
          tokenExpiresAt,
          isPrimary: index === 0,
        },
        create: {
          userId: input.userId,
          platform: Platform.YOUTUBE,
          providerAccountId: channel.channelId,
          channelTitle: channel.channelTitle,
          publishedAt: channel.publishedAt === null ? null : new Date(channel.publishedAt),
          subscriberCount: channel.subscriberCount,
          uploadsPlaylistId: channel.uploadsPlaylistId,
          accessToken: input.accessToken,
          refreshToken: input.refreshToken ?? null,
          scopes: input.scopes ?? null,
          tokenType: input.tokenType ?? null,
          tokenExpiresAt,
          isPrimary: index === 0,
        },
      });
    }),
  );

  return storedChannels;
}

export function buildYouTubeOAuthUrl(userId: string) {
  const clientId = getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const redirectUri = getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI');
  const scopes = process.env.GOOGLE_OAUTH_SCOPES ?? 'openid email profile https://www.googleapis.com/auth/youtube.readonly';

  const state = jwt.sign(
    {
      purpose: 'youtube_connect',
      userId,
      nonce: randomUUID(),
    } satisfies OAuthStatePayload,
    JWT_SECRET,
    { expiresIn: '10m' },
  );

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);

  return url.toString();
}

function verifyOAuthState(state: string) {
  const payload = jwt.verify(state, JWT_SECRET) as OAuthStatePayload;
  if (payload.purpose !== 'youtube_connect') {
    throw new Error('Invalid YouTube OAuth state');
  }
  return payload;
}

async function exchangeCodeForTokens(code: string) {
  const clientId = getRequiredEnv('GOOGLE_OAUTH_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_OAUTH_CLIENT_SECRET');
  const redirectUri = getRequiredEnv('GOOGLE_OAUTH_REDIRECT_URI');

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to exchange Google OAuth code');
  }

  return data;
}

async function fetchOwnedYouTubeChannels(accessToken: string) {
  const response = await fetch(
    'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,contentDetails&mine=true&maxResults=50',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  const data = (await response.json()) as YouTubeMineResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || 'Failed to fetch owned YouTube channels');
  }

  return (data.items ?? []).map((item) => ({
    channelId: item.id,
    channelTitle: item.snippet?.title ?? null,
    publishedAt: item.snippet?.publishedAt ?? null,
    subscriberCount: parseCount(item.statistics?.subscriberCount),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  })) satisfies ConnectedYouTubeChannel[];
}

export async function completeYouTubeOAuth(code: string, state: string) {
  const statePayload = verifyOAuthState(state);
  const tokens = await exchangeCodeForTokens(code);
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw new Error('Google OAuth did not return an access token');
  }

  const channels = await fetchOwnedYouTubeChannels(accessToken);

  if (channels.length === 0) {
    throw new Error('No owned YouTube channels were returned for this Google account');
  }

  const storedChannels = await persistConnectedYouTubeChannels({
    userId: statePayload.userId,
    channels,
    accessToken,
    ...(tokens.refresh_token !== undefined ? { refreshToken: tokens.refresh_token } : {}),
    ...(tokens.scope !== undefined ? { scopes: tokens.scope } : {}),
    ...(tokens.token_type !== undefined ? { tokenType: tokens.token_type } : {}),
    ...(tokens.expires_in !== undefined ? { expiresIn: tokens.expires_in } : {}),
  });

  return {
    userId: statePayload.userId,
    channels,
    storedChannels,
    primaryChannel: storedChannels.find((channel) => channel.isPrimary) ?? storedChannels[0],
    grantedScopes: tokens.scope ?? null,
    tokenType: tokens.token_type ?? null,
    expiresIn: tokens.expires_in ?? null,
    hasRefreshToken: Boolean(tokens.refresh_token),
  };
}
