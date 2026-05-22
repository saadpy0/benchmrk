import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { submitContent, getMySubmissions } from './submission.service.js';

export async function submissionRoutes(app: FastifyInstance) {
  app.post('/campaigns/:id/submit', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can submit content' });
    }

    const { id } = request.params as { id: string };
    const { platform, contentUrl } = request.body as {
      platform: 'INSTAGRAM' | 'YOUTUBE';
      contentUrl: string;
    };

    try {
      const submission = await submitContent(request.user.userId, id, platform, contentUrl);
      return reply.code(201).send(submission);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/my/submissions', { preHandler: authenticate }, async (request, reply) => {
    try {
      const submissions = await getMySubmissions(request.user.userId);
      return reply.send(submissions);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}