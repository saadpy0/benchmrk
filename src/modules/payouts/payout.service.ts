import { prisma } from '../../lib/prisma.js';
import { Decimal } from '@prisma/client/runtime/library.js';
import { calculateTds } from './providers/tds.service.js';
import { RazorpayStub } from './providers/razorpay.stub.js';

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
  const minimumPayout = new Decimal(100);

  if (requestedAmount.lessThan(minimumPayout)) {
    throw new Error('Minimum payout amount is ₹100');
  }

  if (wallet.balance.lessThan(requestedAmount)) {
    throw new Error('Insufficient balance');
  }

  // calculate TDS
  const { tdsAmount, netAmount, tdsApplicable } = calculateTds(
    amount,
    parseFloat(wallet.totalEarned.toString())
  );

  // deduct from wallet and create payout record
  const [updatedWallet, payout] = await prisma.$transaction([
    prisma.earningsWallet.update({
      where: { creatorId: profile.id },
      data: { balance: { decrement: requestedAmount } },
    }),
    prisma.payout.create({
      data: {
        walletId: wallet.id,
        amount: new Decimal(netAmount),
        upiId,
        status: 'PENDING',
      },
    }),
  ]);

  // trigger payment via Razorpay stub
  const razorpay = new RazorpayStub();
  const paymentResult = await razorpay.sendPayout(
    netAmount,
    upiId,
    profile.displayName,
    payout.id
  );

  // update payout status based on payment result
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: paymentResult.success ? 'COMPLETED' : 'FAILED' },
  });

  return {
    payout,
    tdsApplicable,
    tdsAmount,
    netAmount,
    paymentResult,
  };
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