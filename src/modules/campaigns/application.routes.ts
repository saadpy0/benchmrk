import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { applyToCampaign, getMyApplications } from './application.service.js';

export async function applicationRoutes(app: FastifyInstance) {
  app.post('/campaigns/:id/apply', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can apply to campaigns' });
    }

    const { id } = request.params as { id: string };

    try {
      const application = await applyToCampaign(request.user.userId, id);
      return reply.code(201).send(application);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/my/applications', { preHandler: authenticate }, async (request, reply) => {
    try {
      const applications = await getMyApplications(request.user.userId);
      return reply.send(applications);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}