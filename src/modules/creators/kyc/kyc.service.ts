import { prisma } from '../../../lib/prisma.js';
import { KycStub } from './kyc.stub.js';

const kycProvider = new KycStub();

export async function submitKyc(userId: string, pan: string, name: string, aadhaar: string) {
  const profile = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Creator profile not found');
  if (profile.kycStatus === 'VERIFIED') throw new Error('KYC already verified');
  if (profile.kycStatus === 'PENDING') throw new Error('KYC verification already in progress');

  // set to pending immediately
  await prisma.creatorProfile.update({
    where: { userId },
    data: { kycStatus: 'PENDING' },
  });

  // run both verifications
  const [panResult, aadhaarResult] = await Promise.all([
    kycProvider.verifyPAN(pan, name),
    kycProvider.verifyAadhaar(aadhaar),
  ]);

  const verified = panResult.success && aadhaarResult.success;

  // update status based on result
  const updated = await prisma.creatorProfile.update({
    where: { userId },
    data: { kycStatus: verified ? 'VERIFIED' : 'REJECTED' },
  });

  return {
    kycStatus: updated.kycStatus,
    message: verified ? 'KYC verified successfully' : 'KYC verification failed',
  };
}

export async function getKycStatus(userId: string) {
  const profile = await prisma.creatorProfile.findUnique({
    where: { userId },
    select: { kycStatus: true },
  });
  if (!profile) throw new Error('Creator profile not found');
  return { kycStatus: profile.kycStatus };
}