import { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import {
  getWalletBalance,
  requestPayout,
  getPayoutHistory,
  getAllPendingPayouts,
  updatePayoutStatus,
} from './payout.service.js';

export async function payoutRoutes(app: FastifyInstance) {
  // creator checks their balance
  app.get('/payouts/balance', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can view balance' });
    }
    try {
      const balance = await getWalletBalance(request.user.userId);
      return reply.send(balance);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // creator requests a payout
  app.post('/payouts/request', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can request payouts' });
    }

    const { amount, upiId } = request.body as { amount: number; upiId: string };

    if (!amount || !upiId) {
      return reply.code(400).send({ error: 'amount and upiId are required' });
    }

    try {
      const payout = await requestPayout(request.user.userId, amount, upiId);
      return reply.code(201).send(payout);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // creator views payout history
  app.get('/payouts/history', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Only creators can view payout history' });
    }
    try {
      const history = await getPayoutHistory(request.user.userId);
      return reply.send(history);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // admin views all pending payouts
  app.get('/admin/payouts/pending', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Admin access only' });
    }
    try {
      const payouts = await getAllPendingPayouts();
      return reply.send(payouts);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  // admin marks payout as completed or failed
  app.patch('/admin/payouts/:id', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Admin access only' });
    }

    const { id } = request.params as { id: string };
    const { status } = request.body as { status: 'COMPLETED' | 'FAILED' };

    try {
      const payout = await updatePayoutStatus(id, status);
      return reply.send(payout);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}