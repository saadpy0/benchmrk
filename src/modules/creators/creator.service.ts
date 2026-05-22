import { prisma } from '../../lib/prisma.js';

export async function createCreatorProfile(userId: string, displayName: string, bio?: string) {
  const existing = await prisma.creatorProfile.findUnique({ where: { userId } });
  if (existing) throw new Error('Profile already exists');

  return prisma.creatorProfile.create({
    data: {
      userId,
      displayName,
      ...(bio !== undefined ? { bio } : {}),
      wallet: {
        create: {},
      },
    },
  });
}

export async function getCreatorProfile(userId: string) {
  const profile = await prisma.creatorProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!profile) throw new Error('Profile not found');
  return profile;
}