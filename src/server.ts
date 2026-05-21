import Fastify from 'fastify';
import { authRoutes } from './modules/auth/auth.routes.js';
import { authenticate } from './middleware/authenticate.js';

const app = Fastify({ logger: true });

const PORT = 3000;

app.get('/health', async () => {
  return { status: 'ok', message: 'Benchmrk API is running', version: '1.0.0' };
});

app.get('/me', { preHandler: authenticate }, async (request, reply) => {
  return { user: request.user };
});

app.register(authRoutes);

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