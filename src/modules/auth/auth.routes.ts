import type { FastifyInstance } from 'fastify';
import { signup, login } from './auth.service.js';
import { signupSchema, loginSchema } from './auth.schema.js';


export async function authRoutes(app: FastifyInstance) {
  app.post('/auth/signup', { schema: signupSchema }, async (request, reply) => {
    const { email, password, role } = request.body as {
      email: string;
      password: string;
      role: 'CREATOR' | 'BRAND';
    };

    try {
      const result = await signup(email, password, role);
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/auth/login', { schema: loginSchema }, async (request, reply) => {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    try {
      const result = await login(email, password);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(401).send({ error: err.message });
    }
  });
}