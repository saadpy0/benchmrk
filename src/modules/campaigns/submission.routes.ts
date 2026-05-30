import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { submitContent, getMySubmissions } from './submission.service.js';
import { getSubmissionTracking, processDueTrackingJobs, stopSubmissionAnalysis, trackSubmissionNow } from './submission-tracking.service.js';


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

  app.post('/my/submissions/tracking/run-due', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can process their submission tracking jobs' });
    }

    const body = (request.body ?? {}) as { maxJobs?: number };

    try {
      const result = await processDueTrackingJobs({
        userId: request.user.userId,
        ...(body.maxJobs !== undefined ? { maxJobs: body.maxJobs } : {}),
      });
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/my/submissions/:submissionId/track-now', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can track their submissions' });
    }

    const { submissionId } = request.params as { submissionId: string };

    try {
      const result = await trackSubmissionNow(request.user.userId, submissionId);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/my/submissions/:submissionId/stop-analysis', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can stop tracking for their submissions' });
    }

    const { submissionId } = request.params as { submissionId: string };

    try {
      const tracking = await stopSubmissionAnalysis(request.user.userId, submissionId);
      return reply.send(tracking);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/my/submissions/:submissionId/tracking', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can view submission tracking' });
    }

    const { submissionId } = request.params as { submissionId: string };

    try {
      const tracking = await getSubmissionTracking(request.user.userId, submissionId);
      return reply.send(tracking);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}