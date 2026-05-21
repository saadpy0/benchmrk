import Fastify from 'fastify';

const app = Fastify({
  logger: true,
});

const PORT = 3000;

app.get('/health', async (request, reply) => {
  return { status: 'ok', message: 'Server is running' };
});

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