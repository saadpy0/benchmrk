import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

export interface JwtPayload {
  userId: string;
  role: 'CREATOR' | 'BRAND' | 'ADMIN' | 'MODERATOR';
}

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return reply.code(401).send({ error: 'Missing or invalid token' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    request.user = payload;
  } catch {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }
}
