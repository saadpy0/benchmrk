import type { FastifyInstance } from 'fastify';
import { Platform } from '@prisma/client';
import { authenticate } from '../../middleware/auth.js';
import { rebuildBaselineSchema } from './baseline.schema.js';
import { getCreatorBaseline, rebuildCreatorBaseline } from './baseline.service.js';

export async function baselineRoutes(app: FastifyInstance) {
  app.post('/creators/baseline/rebuild', { preHandler: authenticate, schema: rebuildBaselineSchema }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can rebuild their baseline' });
    }

    const body = request.body as {
      platform: Platform;
      accountAgeDays: number;
      followerCount?: number;
      audienceIndiaPct?: number;
      posts: Array<{
        views: number;
        likes: number;
        comments: number;
      }>;
    };

    try {
      const result = await rebuildCreatorBaseline({
        userId: request.user.userId,
        platform: body.platform,
        accountAgeDays: body.accountAgeDays,
        ...(body.followerCount !== undefined ? { followerCount: body.followerCount } : {}),
        ...(body.audienceIndiaPct !== undefined ? { audienceIndiaPct: body.audienceIndiaPct } : {}),
        posts: body.posts,
      });

      return reply.code(200).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/creators/baseline', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can view their baseline' });
    }

    const { platform } = request.query as { platform?: Platform };
    if (!platform || !Object.values(Platform).includes(platform)) {
      return reply.code(400).send({ error: 'platform query param is required' });
    }

    try {
      const baseline = await getCreatorBaseline(request.user.userId, platform);
      return reply.send(baseline);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });
}
