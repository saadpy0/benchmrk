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
import {
  getSubmissionReviewBatchDetails,
  getSubmissionReviewQueue,
  runSubmissionReviewSweep,
  updateSubmissionReviewBatch,
} from './review-queue.service.js';

async function adminGuard(request: any, reply: any) {
  await authenticate(request, reply);
  if (request.user?.role !== 'ADMIN') {
    return reply.code(403).send({ error: 'Admin access only' });
  }
}

export async function adminRoutes(app: FastifyInstance) {
  app.get('/admin/stats', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const stats = await getPlatformStats();
      return reply.send(stats);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/admin/users', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const users = await getAllUsers();
      return reply.send(users);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.delete('/admin/users/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await suspendUser(id);
      return reply.send({ message: 'User suspended successfully' });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/admin/campaigns/pending', { preHandler: adminGuard }, async (request, reply) => {
    try {
      const campaigns = await getPendingCampaigns();
      return reply.send(campaigns);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.patch('/admin/campaigns/:id/approve', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const campaign = await approveCampaign(id);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.patch('/admin/campaigns/:id/reject', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const campaign = await rejectCampaign(id);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

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

  app.post('/admin/review-batches/sweep', { preHandler: adminGuard }, async (request, reply) => {
    const body = (request.body ?? {}) as { campaignId?: string };

    try {
      const result = await runSubmissionReviewSweep(body);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/admin/review-batches', { preHandler: adminGuard }, async (request, reply) => {
    const query = request.query as {
      campaignId?: string;
      status?: 'PENDING_REVIEW' | 'MORE_INFO_REQUESTED' | 'VERIFIED' | 'REJECTED';
    };

    try {
      const queue = await getSubmissionReviewQueue(query);
      return reply.send(queue);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/admin/review-batches/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const batch = await getSubmissionReviewBatchDetails(id);
      return reply.send(batch);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.patch('/admin/review-batches/:id', { preHandler: adminGuard }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      action: 'VERIFY' | 'REJECT' | 'REQUEST_MORE_INFO' | 'PARTIAL_VERIFY';
      note?: string;
      amount?: number;
    };

    try {
      const batch = await updateSubmissionReviewBatch({
        batchId: id,
        action: body.action,
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
      });
      return reply.send(batch);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
