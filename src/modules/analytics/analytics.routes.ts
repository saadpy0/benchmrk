import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import {
  getPlatformAnalytics,
  getBrandAnalytics,
  getCreatorAnalytics,
} from './analytics.service.js';

export async function analyticsRoutes(app: FastifyInstance) {
  // admin — full platform analytics
  app.get('/analytics/platform', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Admin access only' });
    }
    try {
      const analytics = await getPlatformAnalytics();
      return reply.send(analytics);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // brand — their own campaign analytics
  app.get('/analytics/brand', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'BRAND') {
      return reply.code(403).send({ error: 'Only brands can view brand analytics' });
    }
    try {
      const analytics = await getBrandAnalytics(request.user.userId);
      return reply.send(analytics);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // creator — their own performance analytics
  app.get('/analytics/creator', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can view creator analytics' });
    }
    try {
      const analytics = await getCreatorAnalytics(request.user.userId);
      return reply.send(analytics);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}