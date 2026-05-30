'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getDiscoverCampaigns,
  submitToCreatorPortalCampaign,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

/* ─── Platform icons ─────────────────────────────────────────────────────── */

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <defs>
        <linearGradient id="ig-d" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig-d)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="url(#ig-d)" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig-d)"/>
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="#FF0000"/>
      <path d="M10 8.5l5 3.5-5 3.5V8.5z" fill="white"/>
    </svg>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);

  // submit modal
  const [submitModal, setSubmitModal]       = useState<{ campaignId: string; campaignTitle: string } | null>(null);
  const [submitPlatform, setSubmitPlatform] = useState<'YOUTUBE' | 'INSTAGRAM'>('YOUTUBE');
  const [submitUrl, setSubmitUrl]           = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [submitSuccess, setSubmitSuccess]   = useState('');

  useEffect(() => {
    getDiscoverCampaigns()
      .then(r => setCampaigns(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const openSubmitModal = (campaignId: string, campaignTitle: string) => {
    if (!user) { router.push('/login'); return; }
    setSubmitModal({ campaignId, campaignTitle });
    setSubmitUrl('');
    setSubmitPlatform('YOUTUBE');
    setSubmitError('');
    setSubmitSuccess('');
  };

  const handleSubmit = async () => {
    if (!submitModal || !submitUrl.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess('');
    try {
      await submitToCreatorPortalCampaign({
        campaignId: submitModal.campaignId,
        platform: submitPlatform,
        contentUrl: submitUrl.trim(),
      });
      setSubmitSuccess('Submission received! Tracking will begin shortly.');
      setSubmitUrl('');
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isCreator = user?.role === 'CREATOR';

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => router.push('/')}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-lg font-bold tracking-tight">Benchmrk</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => router.push(
                user.role === 'CREATOR' ? '/dashboard/creator' :
                user.role === 'ADMIN'   ? '/dashboard/admin'   :
                '/dashboard/brand'
              )}
              className="text-sm text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-zinc-900"
            >
              Dashboard
            </button>
          ) : (
            <button
              onClick={() => router.push('/login')}
              className="text-sm bg-white text-black font-semibold px-4 py-1.5 rounded-lg hover:bg-zinc-200 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Header ── */}
        <div>
          <h2 className="text-3xl font-bold">Browse Campaigns</h2>
          <p className="text-zinc-400 mt-1.5 text-sm">
            {isCreator
              ? 'Join a campaign and submit your content to start earning'
              : 'Discover live campaigns on Benchmrk'}
          </p>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="flex items-center gap-3 text-zinc-500 text-sm py-16 justify-center">
            <span className="h-5 w-5 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
            Loading campaigns…
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && campaigns.length === 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-white font-semibold mb-1">No live campaigns right now</p>
            <p className="text-zinc-500 text-sm">Check back soon — new campaigns are added regularly</p>
          </div>
        )}

        {/* ── Campaign grid ── */}
        {!loading && campaigns.length > 0 && (
          <div className="space-y-4">
            {campaigns.map((c: any) => {
              const cpv          = Number(c.cpvRate ?? 0);
              const totalBudget  = Number(c.totalBudget ?? 0);
              const spentBudget  = Number(c.spentBudget ?? 0);
              const remaining    = Number(c.remainingBudget ?? totalBudget);
              const budgetPct    = totalBudget > 0 ? Math.min((spentBudget / totalBudget) * 100, 100) : 0;
              const minViews     = Number(c.minimumPayoutViews ?? 0);
              const maxPayout    = Number(c.maxPayoutPerSubmission ?? 0);
              const totalViews   = Number(c.totalViews ?? 0);
              const creatorCount = Number(c.creatorCount ?? 0);

              const fmt = (n: number) =>
                n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
                : n >= 1_000   ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`
                : String(n);

              return (
                <div
                  key={c.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors duration-200"
                >
                  {/* Title + brand row */}
                  <div className="mb-1">
                    <h3 className="text-base font-bold text-white leading-snug">{c.title}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-sm text-zinc-400 font-medium">
                        {c.brand?.companyName ?? c.brandName ?? ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <YouTubeIcon />
                        <InstagramIcon />
                      </div>
                      <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                        LIVE
                      </span>
                    </div>
                  </div>

                  {c.description && (
                    <p className="text-xs text-zinc-500 mt-2 mb-3 line-clamp-2 leading-relaxed">{c.description}</p>
                  )}

                  {/* Budget + rate row */}
                  <div className="flex items-baseline justify-between gap-2 mt-3 mb-1.5">
                    <div>
                      <span className="text-lg font-bold text-white">
                        ₹{fmt(spentBudget)}
                      </span>
                      <span className="text-sm text-zinc-500 ml-1">
                        / ₹{fmt(totalBudget)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-bold text-white">₹{cpv.toFixed(0)}</span>
                      <span className="text-xs text-zinc-500 ml-1">/ 1k views</span>
                    </div>
                  </div>

                  {/* Budget bar */}
                  <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-4">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-500"
                      style={{ width: `${Math.max(budgetPct, budgetPct > 0 ? 1 : 0)}%` }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-5 mb-4 text-sm">
                    <div>
                      <span className="text-zinc-500 text-xs block">Budget left</span>
                      <span className="font-semibold text-white">₹{fmt(remaining)}</span>
                    </div>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div>
                      <span className="text-zinc-500 text-xs block">Views</span>
                      <span className="font-semibold text-white">{fmt(totalViews)}</span>
                    </div>
                    <div className="w-px h-8 bg-zinc-800" />
                    <div>
                      <span className="text-zinc-500 text-xs block">Creators</span>
                      <span className="font-semibold text-white">{creatorCount}</span>
                    </div>
                    {minViews > 0 && (
                      <>
                        <div className="w-px h-8 bg-zinc-800" />
                        <div>
                          <span className="text-zinc-500 text-xs block">Min views</span>
                          <span className="font-semibold text-white">{fmt(minViews)}</span>
                        </div>
                      </>
                    )}
                    {maxPayout > 0 && (
                      <>
                        <div className="w-px h-8 bg-zinc-800" />
                        <div>
                          <span className="text-zinc-500 text-xs block">Max payout</span>
                          <span className="font-semibold text-white">₹{fmt(maxPayout)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  {/* CTA */}
                  {isCreator ? (
                    <button
                      onClick={() => openSubmitModal(c.id, c.title)}
                      className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-900/20"
                    >
                      Submit Content
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/login')}
                      className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm font-medium transition-all"
                    >
                      Sign in to apply
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Submit Content Modal ── */}
      {submitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSubmitModal(null)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-white">Submit Content</h3>
                <p className="text-xs text-zinc-500 mt-0.5">{submitModal.campaignTitle}</p>
              </div>
              <button
                onClick={() => setSubmitModal(null)}
                className="text-zinc-600 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Platform toggle */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Platform</label>
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-1 flex gap-1">
                  {(['YOUTUBE', 'INSTAGRAM'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setSubmitPlatform(p)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        submitPlatform === p ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {p === 'YOUTUBE' ? <YouTubeIcon /> : <InstagramIcon />}
                      {p === 'YOUTUBE' ? 'YouTube' : 'Instagram'}
                    </button>
                  ))}
                </div>
              </div>

              {/* URL input */}
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Content URL</label>
                <input
                  type="url"
                  value={submitUrl}
                  onChange={e => setSubmitUrl(e.target.value)}
                  placeholder={
                    submitPlatform === 'YOUTUBE'
                      ? 'https://youtube.com/watch?v=...'
                      : 'https://instagram.com/p/...'
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors"
                />
              </div>

              {submitError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-xs">
                  {submitError}
                </div>
              )}
              {submitSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-xs">
                  {submitSuccess}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || !submitUrl.trim()}
                className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-red-900/20"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Submitting…
                  </span>
                ) : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
