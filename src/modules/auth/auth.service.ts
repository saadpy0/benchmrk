import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

export async function googleAuth(accessToken: string, role: 'CREATOR' | 'BRAND') {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Invalid Google access token');
  const info = await res.json() as GoogleUserInfo;
  if (!info.email_verified) throw new Error('Google account email is not verified');

  let user = await prisma.user.findUnique({ where: { email: info.email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email: info.email, passwordHash: '', role },
    });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function signup(email: string, password: string, role: 'CREATOR' | 'BRAND') {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Email already in use');

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: { email, passwordHash, role },
  });

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error('Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid email or password');

  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  return { token, user: { id: user.id, email: user.email, role: user.role } };
}