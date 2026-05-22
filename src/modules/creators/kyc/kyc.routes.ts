import { FastifyInstance } from 'fastify';
import { authenticate } from '../../../middleware/authenticate.js';
import { submitKyc, getKycStatus } from './kyc.service.js';

export async function kycRoutes(app: FastifyInstance) {
  app.post('/creators/kyc', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can submit KYC' });
    }

    const { pan, name, aadhaar } = request.body as {
      pan: string;
      name: string;
      aadhaar: string;
    };

    if (!pan || !name || !aadhaar) {
      return reply.code(400).send({ error: 'pan, name and aadhaar are required' });
    }

    try {
      const result = await submitKyc(request.user.userId, pan, name, aadhaar);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/creators/kyc', { preHandler: authenticate }, async (request, reply) => {
    try {
      const result = await getKycStatus(request.user.userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message });
    }
  });
}