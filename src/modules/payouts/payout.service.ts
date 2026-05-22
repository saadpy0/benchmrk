import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library.js';

export async function getOrCreateWallet(creatorId: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: creatorId } });
  if (!profile) throw new Error('Creator profile not found');

  const existing = await prisma.earningsWallet.findUnique({ where: { creatorId: profile.id } });
  if (existing) return existing;

  return prisma.earningsWallet.create({
    data: { creatorId: profile.id },
  });
}

export async function getWalletBalance(creatorId: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: creatorId } });
  if (!profile) throw new Error('Creator profile not found');

  const wallet = await prisma.earningsWallet.findUnique({
    where: { creatorId: profile.id },
  });

  if (!wallet) return { balance: 0, totalEarned: 0 };
  return { balance: wallet.balance, totalEarned: wallet.totalEarned };
}

export async function creditEarnings(creatorProfileId: string, amount: Decimal) {
  // called by the verification engine when views are confirmed
  const wallet = await prisma.earningsWallet.upsert({
    where: { creatorId: creatorProfileId },
    update: {
      balance: { increment: amount },
      totalEarned: { increment: amount },
    },
    create: {
      creatorId: creatorProfileId,
      balance: amount,
      totalEarned: amount,
    },
  });
  return wallet;
}

export async function requestPayout(creatorId: string, amount: number, upiId: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: creatorId } });
  if (!profile) throw new Error('Creator profile not found');

  if (profile.kycStatus !== 'VERIFIED') {
    throw new Error('KYC must be verified before requesting a payout');
  }

  const wallet = await prisma.earningsWallet.findUnique({ where: { creatorId: profile.id } });
  if (!wallet) throw new Error('No earnings wallet found');

  const requestedAmount = new Decimal(amount);
  const minimumPayout = new Decimal(100); // ₹100 minimum

  if (requestedAmount.lessThan(minimumPayout)) {
    throw new Error('Minimum payout amount is ₹100');
  }

  if (wallet.balance.lessThan(requestedAmount)) {
    throw new Error('Insufficient balance');
  }

  // deduct from wallet and create payout record in one transaction
  const [updatedWallet, payout] = await prisma.$transaction([
    prisma.earningsWallet.update({
      where: { creatorId: profile.id },
      data: { balance: { decrement: requestedAmount } },
    }),
    prisma.payout.create({
      data: {
        walletId: wallet.id,
        amount: requestedAmount,
        upiId,
        status: 'PENDING',
      },
    }),
  ]);

  return payout;
}

export async function getPayoutHistory(creatorId: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId: creatorId } });
  if (!profile) throw new Error('Creator profile not found');

  const wallet = await prisma.earningsWallet.findUnique({ where: { creatorId: profile.id } });
  if (!wallet) return [];

  return prisma.payout.findMany({
    where: { walletId: wallet.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getAllPendingPayouts() {
  return prisma.payout.findMany({
    where: { status: 'PENDING' },
    include: {
      wallet: {
        include: {
          creator: { select: { displayName: true, userId: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updatePayoutStatus(payoutId: string, status: 'COMPLETED' | 'FAILED') {
  return prisma.payout.update({
    where: { id: payoutId },
    data: { status },
  });
}