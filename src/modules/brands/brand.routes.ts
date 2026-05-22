import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { createBrandProfile, getBrandProfile } from './brand.service.js';
import { createBrandProfileSchema } from './brand.schema.js';

export async function brandRoutes(app: FastifyInstance) {
  app.post('/brands/profile', { preHandler: authenticate, schema: createBrandProfileSchema }, async (request, reply) => {
    if (request.user.role !== 'BRAND') {
      return reply.code(403).send({ error: 'Only brands can create a brand profile' });
    }

    const { companyName, gstNumber } = request.body as { companyName: string; gstNumber?: string };

    try {
      const profile = await createBrandProfile(request.user.userId, companyName, gstNumber);
      return reply.code(201).send(profile);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/brands/profile', { preHandler: authenticate }, async (request, reply) => {
    try {
      const profile = await getBrandProfile(request.user.userId);
      return reply.send(profile);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });
}