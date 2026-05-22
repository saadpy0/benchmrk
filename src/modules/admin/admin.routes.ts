import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getAllUsers,
  getPendingCampaigns,
  approveCampaign,
  rejectCampaign,
  suspendUser,
  getPlatformStats,
  updateApplicationStatus,
} from './admin.service.js';

async function adminGuard(request: any, reply: any) {
  await authenticate(request, reply);
  if (request.user?.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Admin access only' });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  // platform stats
  app.get('/admin/stats', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const stats = await getPlatformStats();
      return reply.send(stats);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // get all users
  app.get('/admin/users', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const users = await getAllUsers();
      return reply.send(users);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // suspend a user
  app.delete('/admin/users/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await suspendUser(id);
      return reply.send({ message: 'User suspended successfully' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // get campaigns pending review
  app.get('/admin/campaigns/pending', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const campaigns = await getPendingCampaigns();
      return reply.send(campaigns);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // approve a campaign
  app.patch('/admin/campaigns/:id/approve', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const campaign = await approveCampaign(id);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // reject a campaign
  app.patch('/admin/campaigns/:id/reject', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const campaign = await rejectCampaign(id);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // accept or reject a creator application
  app.patch('/admin/applications/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'ACCEPTED' | 'REJECTED' };
    try {
      const application = await updateApplicationStatus(id, status);
      return reply.send(application);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}