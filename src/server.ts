import Fastify from 'fastify';

const app = Fastify({
  logger: true,
});

const PORT = 3000;

app.get('/health', async (request, reply) => {
  return { 
    status: 'ok', 
    message: 'Benchmrk API is running',
    version: '1.0.0'
  };
});

app.get('/', async (request, reply) => {
  return { 
    message: 'Welcome to Benchmrk API'
  };
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