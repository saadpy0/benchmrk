import Fastify from 'fastify';
import { authRoutes } from './modules/auth/auth.routes.js';

const app = Fastify({ logger: true });

const PORT = 3000;

app.get('/health', async () => {
  return { status: 'ok', message: 'Benchmrk API is running', version: '1.0.0' };
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