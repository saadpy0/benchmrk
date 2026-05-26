import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { createCampaign, getCampaigns, getCampaignById, updateCampaignStatus } from './campaign.service.js';
import { createCampaignSchema, updateStatusSchema } from './campaign.schema.js';
import type { CampaignStatus } from '@prisma/client';

export async function campaignRoutes(app: FastifyInstance) {
  // brand creates a campaign
  app.post('/campaigns', { preHandler: authenticate, schema: createCampaignSchema }, async (request, reply) => {
    if (request.user.role !== 'BRAND') {
      return reply.code(403).send({ error: 'Only brands can create campaigns' });
    }

    const body = request.body as {
      title: string;
      description: string;
      guidelines: string;
      cpvRate: number;
      totalBudget: number;
      minimumPayoutViews?: number;
      maxPayoutPerSubmission?: number;
      startDate: string;
      endDate: string;
    };

    try {
      const campaign = await createCampaign(request.user.userId, body);
      return reply.code(201).send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // get all live campaigns (creators browse these)
  app.get('/campaigns', { preHandler: authenticate }, async (request, reply) => {
    const { status } = request.query as { status?: CampaignStatus };
    try {
      const campaigns = await getCampaigns(status);
      return reply.send(campaigns);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // get single campaign
  app.get('/campaigns/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const campaign = await getCampaignById(id);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });

  // admin updates campaign status (approve, reject, etc)
  app.patch('/campaigns/:id/status', { preHandler: authenticate, schema: updateStatusSchema }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can update campaign status' });
    }

    const { id } = request.params as { id: string };
    const { status } = request.body as { status: CampaignStatus };

    try {
      const campaign = await updateCampaignStatus(id, status);
      return reply.send(campaign);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}