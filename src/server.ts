import Fastify from 'fastify';
import { authRoutes } from './modules/auth/auth.routes.js';
import { authenticate } from './middleware/authenticate.js';
import { creatorRoutes } from './modules/creators/creator.routes.js';
import { brandRoutes } from './modules/brands/brand.routes.js';
import { campaignRoutes } from './modules/campaigns/campaign.routes.js';
import { applicationRoutes } from './modules/campaigns/application.routes.js';
import { submissionRoutes } from './modules/campaigns/submission.routes.js';

const app = Fastify({ logger: true });

const PORT = 3000;

app.get('/health', async () => {
  return { status: 'ok', message: 'Benchmrk API is running', version: '1.0.0' };
});

app.get('/me', { preHandler: authenticate }, async (request, reply) => {
  return { user: request.user };
});

app.register(authRoutes);
app.register(creatorRoutes, { prefix: '/' });
app.register(brandRoutes, { prefix: '/' });
app.register(campaignRoutes, { prefix: '/' });
app.register(applicationRoutes, { prefix: '/' });
app.register(submissionRoutes, { prefix: '/' });

const start = async () => {
  try {
    await app.listen({ port: PORT });
    console.log(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();