import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { createCreatorProfile, getCreatorProfile } from './creator.service.js';
import { createProfileSchema } from './creator.schema.js';
import { rebuildInstagramAccountTrustScore } from './instagram-baseline.service.js';
import { rebuildYoutubeAccountTrustScore } from './youtube-baseline.service.js';
import { recalculateReputationScore } from './baseline.service.js';


export async function creatorRoutes(app: FastifyInstance) {
  app.post('/creators/profile', { preHandler: authenticate, schema: createProfileSchema }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can create a creator profile' });
    }

    const { displayName, bio } = request.body as { displayName: string; bio?: string };

    try {
      const profile = await createCreatorProfile(request.user.userId, displayName, bio);
      return reply.code(201).send(profile);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/creators/profile', { preHandler: authenticate }, async (request, reply) => {
    try {
      const profile = await getCreatorProfile(request.user.userId);
      return reply.send(profile);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  app.get('/creators/connected-accounts', { preHandler: authenticate }, async (request, reply) => {
    const accounts = await prisma.connectedPlatformAccount.findMany({
      where: { userId: request.user.userId },
      orderBy: [{ platform: 'asc' }, { isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        platform: true,
        providerAccountId: true,
        channelTitle: true,
        subscriberCount: true,
        isPrimary: true,
        trustScore: true,
        baselineAvgViews: true,
        baselineEngagement: true,
        baselineFollowerCount: true,
        createdAt: true,
      },
    });
    return reply.send(accounts);
  });

  app.post('/creators/connected-accounts/:accountId/rebuild', { preHandler: authenticate }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    try {
      const account = await prisma.connectedPlatformAccount.findFirst({
        where: { id: accountId, userId: request.user.userId },
      });
      if (!account) return reply.code(404).send({ error: 'Account not found' });

      if (account.platform === 'INSTAGRAM') {
        const result = await rebuildInstagramAccountTrustScore({ userId: request.user.userId, accountId });
        return reply.send(result);
      } else {
        const result = await rebuildYoutubeAccountTrustScore({ userId: request.user.userId, accountId });
        return reply.send(result);
      }
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.delete('/creators/connected-accounts/:accountId', { preHandler: authenticate }, async (request, reply) => {
    const { accountId } = request.params as { accountId: string };
    try {
      const account = await prisma.connectedPlatformAccount.findFirst({
        where: { id: accountId, userId: request.user.userId },
      });
      if (!account) return reply.code(404).send({ error: 'Account not found' });
      await prisma.connectedPlatformAccount.delete({ where: { id: accountId } });
      await recalculateReputationScore(request.user.userId).catch(() => {});
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}