import Fastify from 'fastify';
import { authRoutes } from './modules/auth/auth.routes.js';
import { instagramOAuthRoutes } from './modules/auth/instagram-oauth.routes.js';
import { youtubeOAuthRoutes } from './modules/auth/youtube-oauth.routes.js';
import { authenticate } from './middleware/auth.js';
import { creatorRoutes } from './modules/creators/creator.routes.js';
import { baselineRoutes } from './modules/creators/baseline.routes.js';
import { baselineDevRoutes } from './modules/creators/baseline.dev.routes.js';
import { creatorPortalRoutes } from './modules/creators/creator.portal.routes.js';
import { brandRoutes } from './modules/brands/brand.routes.js';
import { campaignRoutes } from './modules/campaigns/campaign.routes.js';
import { applicationRoutes } from './modules/campaigns/application.routes.js';
import { submissionRoutes } from './modules/campaigns/submission.routes.js';
import { startSubmissionTrackingWorker } from './modules/campaigns/submission-tracking.worker.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { adminDevRoutes } from './modules/admin/admin.dev.routes.js';
import { kycRoutes } from './modules/creators/kyc/kyc.routes.js';
import { payoutRoutes } from './modules/payouts/payout.routes.js';
import { analyticsRoutes } from './modules/analytics/analytics.routes.js';

const app = Fastify({ logger: true });

const PORT = 3000;

app.get('/health', async () => {
  return { status: 'ok', message: 'Benchmrk API is running', version: '1.0.0' };
});

app.get('/me', { preHandler: authenticate }, async (request, reply) => {
  return { user: request.user };
});

app.register(authRoutes);
app.register(instagramOAuthRoutes);
app.register(youtubeOAuthRoutes);
app.register(creatorRoutes, { prefix: '/' });
app.register(creatorPortalRoutes, { prefix: '/' });
app.register(baselineRoutes, { prefix: '/' });
app.register(baselineDevRoutes, { prefix: '/' });
app.register(brandRoutes, { prefix: '/' });
app.register(campaignRoutes, { prefix: '/' });
app.register(applicationRoutes, { prefix: '/' });
app.register(submissionRoutes, { prefix: '/' });
app.register(adminRoutes, { prefix: '/' });
app.register(adminDevRoutes, { prefix: '/' });
app.register(kycRoutes, { prefix: '/' });
app.register(payoutRoutes, { prefix: '/' });
app.register(analyticsRoutes, { prefix: '/' });

const start = async () => {
  try {
    await app.listen({ port: PORT });
    startSubmissionTrackingWorker(app.log);
    console.log(`Server running at http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();