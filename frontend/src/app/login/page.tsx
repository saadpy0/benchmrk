'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useGoogleLogin } from '@react-oauth/google';
import { login, googleLogin } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { jwtDecode } from 'jwt-decode';

type Role = 'CREATOR' | 'BRAND';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [role, setRole] = useState<Role>('CREATOR');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleAuthSuccess = (token: string, userEmail: string) => {
    setToken(token);
    const decoded = jwtDecode<{ userId: string; role: 'CREATOR' | 'BRAND' | 'ADMIN' }>(token);
    setUser({ id: decoded.userId, email: userEmail, role: decoded.role });
    if (decoded.role === 'CREATOR') router.push('/dashboard/creator');
    else if (decoded.role === 'BRAND') router.push('/dashboard/brand');
    else if (decoded.role === 'ADMIN') router.push('/dashboard/admin');
    else router.push('/');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await login(email, password);
      handleAuthSuccess(res.data.token, res.data.user.email);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        const res = await googleLogin(tokenResponse.access_token, role);
        handleAuthSuccess(res.data.token, res.data.user.email);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Google sign-in failed');
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => {
      setError('Google sign-in was cancelled or failed');
      setGoogleLoading(false);
    },
  });

  const isCreator = role === 'CREATOR';

  return (
    <div className="min-h-screen bg-black flex">

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-zinc-950 border-r border-zinc-800/50">

        {/* Red glow blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-red-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-red-700/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-red-500/5 rounded-full blur-2xl" />

        {/* Logo */}
        <div className="relative flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-2xl font-bold text-white tracking-tight">Benchmrk</span>
        </div>

        {/* Main copy */}
        <div className="relative space-y-6">
          <div className="space-y-3">
            <span className="inline-block text-xs font-semibold text-red-400 uppercase tracking-widest bg-red-500/10 border border-red-500/20 px-3 py-1 rounded-full">
              {isCreator ? 'For Creators' : 'For Brands'}
            </span>
            <h2 className="text-4xl font-bold text-white leading-tight">
              {isCreator
                ? 'Turn your audience into income'
                : 'Find creators that actually convert'}
            </h2>
            <p className="text-zinc-400 text-lg leading-relaxed">
              {isCreator
                ? 'Apply to campaigns from top Indian brands, get paid per verified view.'
                : 'Access vetted creators with verified engagement and transparent trust scores.'}
            </p>
          </div>

          {/* Divider line */}
          <div className="w-12 h-0.5 bg-red-500 rounded-full" />

          {/* Stats */}
          <div className="flex gap-8">
            {isCreator ? (
              <>
                <div>
                  <p className="text-2xl font-bold text-white">10k+</p>
                  <p className="text-zinc-500 text-sm mt-0.5">Active campaigns</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">₹2Cr+</p>
                  <p className="text-zinc-500 text-sm mt-0.5">Paid out to date</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">48h</p>
                  <p className="text-zinc-500 text-sm mt-0.5">Avg payout time</p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="text-2xl font-bold text-white">50k+</p>
                  <p className="text-zinc-500 text-sm mt-0.5">Verified creators</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">99%</p>
                  <p className="text-zinc-500 text-sm mt-0.5">View accuracy</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">India-first</p>
                  <p className="text-zinc-500 text-sm mt-0.5">Audience verified</p>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="relative text-zinc-600 text-sm">© 2025 Benchmrk. All rights reserved.</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-black relative">
        {/* Subtle red glow top-right on mobile */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none" />

        <div className="w-full max-w-sm space-y-7 relative">

          {/* Logo (mobile) */}
          <div className="lg:hidden flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-2xl font-bold text-white tracking-tight">Benchmrk</span>
          </div>

          {/* Role toggle */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-1 flex">
            <button
              type="button"
              onClick={() => setRole('CREATOR')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                role === 'CREATOR'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-900/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Creator
            </button>
            <button
              type="button"
              onClick={() => setRole('BRAND')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all duration-200 ${
                role === 'BRAND'
                  ? 'bg-red-600 text-white shadow-sm shadow-red-900/50'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Brand
            </button>
          </div>

          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-white">
              {isCreator ? 'Welcome back' : 'Sign in to your account'}
            </h1>
            <p className="text-zinc-400 text-sm">
              {isCreator
                ? 'Sign in to manage your campaigns and track earnings.'
                : 'Sign in to manage your brand campaigns.'}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            type="button"
            onClick={() => handleGoogleLogin()}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-700 hover:border-red-500/40 text-white text-sm font-medium py-2.5 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="h-4 w-4 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-800" />
            <span className="text-zinc-600 text-xs">or continue with email</span>
            <div className="flex-1 h-px bg-zinc-800" />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-zinc-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-red-500/60 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors"
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-zinc-300">Password</label>
                <button type="button" className="text-xs text-zinc-500 hover:text-red-400 transition-colors">
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 focus:border-red-500/60 rounded-xl px-4 py-2.5 text-white placeholder-zinc-600 text-sm focus:outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-200 text-sm disabled:opacity-50 disabled:cursor-not-allowed mt-1 shadow-lg shadow-red-900/30"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-zinc-500 text-sm">
            Don&apos;t have an account?{' '}
            <Link
              href={`/signup?role=${role.toLowerCase()}`}
              className="text-red-400 hover:text-red-300 font-medium transition-colors"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
