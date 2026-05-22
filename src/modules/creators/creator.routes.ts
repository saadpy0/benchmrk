import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { createCreatorProfile, getCreatorProfile } from './creator.service.js';
import { createProfileSchema } from './creator.schema.js';

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
}