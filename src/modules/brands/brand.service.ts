import { prisma } from '../../lib/prisma.js';

export async function createBrandProfile(userId: string, companyName: string, gstNumber?: string) {
  const existing = await prisma.brandProfile.findUnique({ where: { userId } });
  if (existing) throw new Error('Brand profile already exists');

  return prisma.brandProfile.create({
    data: {
      userId,
      companyName,
      ...(gstNumber !== undefined ? { gstNumber } : {}),
    },
  });
}

export async function getBrandProfile(userId: string) {
  const profile = await prisma.brandProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!profile) throw new Error('Profile not found');
  return profile;
}