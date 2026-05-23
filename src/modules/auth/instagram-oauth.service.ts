import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { Platform } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

type OAuthStatePayload = {
  purpose: 'instagram_connect';
  userId: string;
  nonce: string;
};

type InstagramTokenResponse = {
  access_token?: string;
  user_id?: string | number;
  permissions?: string | string[];
  token_type?: string;
  expires_in?: number;
  error_type?: string;
  error_message?: string;
  error?: {
    message?: string;
  };
};

type InstagramProfileResponse = {
  id?: string;
  username?: string;
  name?: string;
  account_type?: string;
  media_count?: number;
  followers_count?: number;
  profile_picture_url?: string;
};

type ConnectedInstagramAccount = {
  accountId: string;
  username: string | null;
  displayName: string | null;
  followerCount: number | null;
  mediaCount: number | null;
  accountType: string | null;
};

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function getInstagramScopes() {
  return process.env.INSTAGRAM_OAUTH_SCOPES ?? 'instagram_business_basic,instagram_business_manage_insights';
}

function normalizeNullableInt(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
}

function serializePermissions(value?: string | string[]) {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value.join(',');
  }
  return value;
}

async function persistConnectedInstagramAccounts(input: {
  userId: string;
  accounts: ConnectedInstagramAccount[];
  accessToken: string;
  permissions?: string | string[];
  tokenType?: string;
  expiresIn?: number;
}) {
  await prisma.connectedPlatformAccount.updateMany({
    where: {
      userId: input.userId,
      platform: Platform.INSTAGRAM,
    },
    data: {
      isPrimary: false,
    },
  });

  const existingAccounts = await prisma.connectedPlatformAccount.findMany({
    where: {
      platform: Platform.INSTAGRAM,
      providerAccountId: {
        in: input.accounts.map((account) => account.accountId),
      },
    },
  });

  const existingByAccountId = new Map(existingAccounts.map((account) => [account.providerAccountId, account]));
  const tokenExpiresAt = input.expiresIn === undefined ? null : new Date(Date.now() + input.expiresIn * 1000);
  const serializedPermissions = serializePermissions(input.permissions);

  const storedAccounts = await Promise.all(
    input.accounts.map((account, index) => {
      const existing = existingByAccountId.get(account.accountId);
      const title = account.username ?? account.displayName ?? existing?.channelTitle ?? null;

      return prisma.connectedPlatformAccount.upsert({
        where: {
          platform_providerAccountId: {
            platform: Platform.INSTAGRAM,
            providerAccountId: account.accountId,
          },
        },
        update: {
          userId: input.userId,
          channelTitle: title,
          subscriberCount: account.followerCount,
          uploadsPlaylistId: account.accountType,
          accessToken: input.accessToken,
          refreshToken: null,
          scopes: serializedPermissions ?? null,
          tokenType: input.tokenType ?? null,
          tokenExpiresAt,
          isPrimary: index === 0,
        },
        create: {
          userId: input.userId,
          platform: Platform.INSTAGRAM,
          providerAccountId: account.accountId,
          channelTitle: title,
          subscriberCount: account.followerCount,
          uploadsPlaylistId: account.accountType,
          accessToken: input.accessToken,
          refreshToken: null,
          scopes: serializedPermissions ?? null,
          tokenType: input.tokenType ?? null,
          tokenExpiresAt,
          isPrimary: index === 0,
        },
      });
    }),
  );

  return storedAccounts;
}

export function buildInstagramOAuthUrl(userId: string) {
  const clientId = getRequiredEnv('INSTAGRAM_APP_ID');
  const redirectUri = getRequiredEnv('INSTAGRAM_REDIRECT_URI');
  const scopes = getInstagramScopes();

  const state = jwt.sign(
    {
      purpose: 'instagram_connect',
      userId,
      nonce: randomUUID(),
    } satisfies OAuthStatePayload,
    JWT_SECRET,
    { expiresIn: '10m' },
  );

  const url = new URL('https://www.instagram.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scopes);
  url.searchParams.set('state', state);

  return url.toString();
}

function verifyOAuthState(state: string) {
  const payload = jwt.verify(state, JWT_SECRET) as OAuthStatePayload;
  if (payload.purpose !== 'instagram_connect') {
    throw new Error('Invalid Instagram OAuth state');
  }
  return payload;
}

async function exchangeCodeForTokens(code: string) {
  const clientId = getRequiredEnv('INSTAGRAM_APP_ID');
  const clientSecret = getRequiredEnv('INSTAGRAM_APP_SECRET');
  const redirectUri = getRequiredEnv('INSTAGRAM_REDIRECT_URI');

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });

  const data = (await response.json()) as InstagramTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_message || data.error?.message || data.error_type || 'Failed to exchange Instagram OAuth code');
  }

  return data;
}

async function fetchOwnedInstagramAccount(accessToken: string) {
  const url = new URL('https://graph.instagram.com/v24.0/me');
  url.searchParams.set('fields', 'id,username,name,account_type,media_count,followers_count,profile_picture_url');
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url);
  const data = (await response.json()) as InstagramProfileResponse & {
    error?: { message?: string };
  };

  if (!response.ok || !data.id) {
    throw new Error(data.error?.message || 'Failed to fetch connected Instagram account');
  }

  const accountType = typeof data.account_type === 'string' ? data.account_type : null;
  if (accountType !== null && accountType !== 'BUSINESS' && accountType !== 'MEDIA_CREATOR') {
    throw new Error('Only Instagram professional accounts are supported');
  }

  return {
    accountId: data.id,
    username: typeof data.username === 'string' ? data.username : null,
    displayName: typeof data.name === 'string' ? data.name : null,
    followerCount: normalizeNullableInt(data.followers_count),
    mediaCount: normalizeNullableInt(data.media_count),
    accountType,
  } satisfies ConnectedInstagramAccount;
}

export async function completeInstagramOAuth(code: string, state: string) {
  const statePayload = verifyOAuthState(state);
  const tokens = await exchangeCodeForTokens(code);
  const accessToken = tokens.access_token;
  if (!accessToken) {
    throw new Error('Instagram OAuth did not return an access token');
  }

  const account = await fetchOwnedInstagramAccount(accessToken);
  const storedAccounts = await persistConnectedInstagramAccounts({
    userId: statePayload.userId,
    accounts: [account],
    accessToken,
    ...(tokens.permissions !== undefined ? { permissions: tokens.permissions } : {}),
    ...(tokens.token_type !== undefined ? { tokenType: tokens.token_type } : {}),
    ...(tokens.expires_in !== undefined ? { expiresIn: tokens.expires_in } : {}),
  });

  return {
    userId: statePayload.userId,
    account,
    storedAccounts,
    primaryAccount: storedAccounts.find((storedAccount) => storedAccount.isPrimary) ?? storedAccounts[0],
    tokenType: tokens.token_type ?? null,
    expiresIn: tokens.expires_in ?? null,
  };
}
