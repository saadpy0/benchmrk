import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import { buildInstagramOAuthUrl, completeInstagramOAuth } from './instagram-oauth.service.js';

export async function instagramOAuthRoutes(app: FastifyInstance) {
  app.get('/auth/instagram/start', { preHandler: authenticate }, async (request, reply) => {
    try {
      const authUrl = buildInstagramOAuthUrl(request.user.userId);
      return reply.send({ authUrl });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/auth/instagram/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };

    if (!code || !state) {
      return reply.code(400).type('text/html').send('<h1>Missing Instagram OAuth callback parameters</h1>');
    }

    try {
      const result = await completeInstagramOAuth(code, state);
      const payload = JSON.stringify({ ok: true, data: result }).replace(/</g, '\\u003c');
      return reply.type('text/html').send(`<!doctype html><html><body><script>const payload=${payload};localStorage.setItem('instagramConnectResult', JSON.stringify(payload));if(window.opener){window.opener.postMessage({type:'instagram-connect-result',payload}, window.location.origin);}window.close();</script><p>Instagram connected. You can close this window.</p></body></html>`);
    } catch (err: any) {
      const payload = JSON.stringify({ ok: false, error: err.message || 'Instagram OAuth failed' }).replace(/</g, '\\u003c');
      return reply.type('text/html').send(`<!doctype html><html><body><script>const payload=${payload};localStorage.setItem('instagramConnectResult', JSON.stringify(payload));if(window.opener){window.opener.postMessage({type:'instagram-connect-result',payload}, window.location.origin);}window.close();</script><p>Instagram connection failed. You can close this window.</p></body></html>`);
    }
  });
}
