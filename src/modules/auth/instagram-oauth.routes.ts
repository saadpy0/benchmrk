import type { FastifyInstance } from 'fastify';
import { Platform } from '@prisma/client';
import { authenticate } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';
import { buildInstagramOAuthUrl, completeInstagramOAuth } from './instagram-oauth.service.js';

export async function instagramOAuthRoutes(app: FastifyInstance) {
  app.delete('/auth/instagram/disconnect', { preHandler: authenticate }, async (request, reply) => {
    try {
      await prisma.connectedPlatformAccount.deleteMany({
        where: { userId: request.user.userId, platform: Platform.INSTAGRAM },
      });
      return reply.send({ ok: true });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/auth/instagram/start', { preHandler: authenticate }, async (request, reply) => {
    try {
      const authUrl = buildInstagramOAuthUrl(request.user.userId);
      return reply.send({ authUrl });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/auth/instagram/callback', async (request, reply) => {
    const { code, state, error, error_reason, error_description } = request.query as {
      code?: string;
      state?: string;
      error?: string;
      error_reason?: string;
      error_description?: string;
    };

    if (error || !code || !state) {
      const message = error_description || error_reason || error || 'Instagram authorisation was cancelled or denied';
      app.log.warn({ error, error_reason, error_description }, 'Instagram OAuth error redirect');
      const payload = JSON.stringify({ ok: false, error: message }).replace(/</g, '\\u003c');
      return reply.type('text/html').send(`<!doctype html><html><body><script>const payload=${payload};if(window.opener){window.opener.postMessage({type:'instagram-connect-result',payload}, '*');}window.close();</script><p>${message}. You can close this window.</p></body></html>`);
    }

    try {
      const result = await completeInstagramOAuth(code, state);
      const payload = JSON.stringify({ ok: true, data: result }).replace(/</g, '\\u003c');
      return reply.type('text/html').send(`<!doctype html><html><body><script>const payload=${payload};localStorage.setItem('instagramConnectResult', JSON.stringify(payload));if(window.opener){window.opener.postMessage({type:'instagram-connect-result',payload}, '*');}window.close();</script><p>Instagram connected. You can close this window.</p></body></html>`);
    } catch (err: any) {
      const payload = JSON.stringify({ ok: false, error: err.message || 'Instagram OAuth failed' }).replace(/</g, '\\u003c');
      return reply.type('text/html').send(`<!doctype html><html><body><script>const payload=${payload};localStorage.setItem('instagramConnectResult', JSON.stringify(payload));if(window.opener){window.opener.postMessage({type:'instagram-connect-result',payload}, '*');}window.close();</script><p>Instagram connection failed. You can close this window.</p></body></html>`);
    }
  });
}
