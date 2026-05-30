'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getCreatorProfile,
  getCreatorAnalytics,
  getWalletBalance,
  getMyApplications,
  getInstagramOAuthUrl,
  getYouTubeOAuthUrl,
  getConnectedAccounts,
  disconnectAccount,
  rebuildAccountTrustScore,
  rebuildInstagramConnectedBaseline,
  rebuildYouTubeConnectedBaseline,
  rebuildYouTubeLiveBaseline,
  getCreatorPortalDashboard,
  submitToCreatorPortalCampaign,
  runCreatorPortalTracking,
} from '@/lib/api';

/* ─── Trust helpers ─────────────────────────────────────────────────────── */

function getTrustTier(score: number) {
  if (score >= 90) return { label: 'High Confidence', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' };
  if (score >= 75) return { label: 'Trusted',         color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/30' };
  if (score >= 55) return { label: 'Watchlist',        color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/30' };
  return               { label: 'Unverified',          color: 'text-zinc-500',    bg: 'bg-zinc-800',      border: 'border-zinc-700' };
}

function TrustBadge({ score }: { score: number }) {
  const t = getTrustTier(score);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${t.bg} ${t.border} ${t.color}`}>
      <span className="font-bold">{Math.round(score)}</span>
      <span className="opacity-60">·</span>
      {t.label}
    </span>
  );
}

/* ─── Submission status badge ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    VERIFIED:             { label: 'Verified',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    UNDER_REVIEW:         { label: 'Under Review',  color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
    PENDING_REVIEW:       { label: 'Pending Review',color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
    REJECTED:             { label: 'Rejected',      color: 'text-red-400',     bg: 'bg-red-500/10',    border: 'border-red-500/20' },
  };
  const s = map[status] ?? { label: status, color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.color}`}>
      {s.label}
    </span>
  );
}

/* ─── Platform icons ─────────────────────────────────────────────────────── */

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
      <defs>
        <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433"/>
          <stop offset="25%" stopColor="#e6683c"/>
          <stop offset="50%" stopColor="#dc2743"/>
          <stop offset="75%" stopColor="#cc2366"/>
          <stop offset="100%" stopColor="#bc1888"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="url(#ig)" strokeWidth="2"/>
      <circle cx="12" cy="12" r="4" stroke="url(#ig)" strokeWidth="2"/>
      <circle cx="17.5" cy="6.5" r="1" fill="url(#ig)"/>
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

/* ─── Stat card ──────────────────────────────────────────────────────────── */

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-hidden hover:border-zinc-700 transition-colors duration-200">
      <div className={`absolute top-0 left-0 right-0 h-px ${accent ?? 'bg-zinc-700'}`} />
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-3">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

/* ─── Section header ─────────────────────────────────────────────────────── */

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {right}
    </div>
  );
}

/* ─── Main dashboard ─────────────────────────────────────────────────────── */

export default function CreatorDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();

  const [profile, setProfile]           = useState<any>(null);
  const [analytics, setAnalytics]       = useState<any>(null);
  const [wallet, setWallet]             = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);

  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [ytAccounts, setYtAccounts] = useState<any[]>([]);

  // creator portal data
  const [portalDashboard, setPortalDashboard]   = useState<any>(null);
  const [portalLoading, setPortalLoading]       = useState(false);

  // submit modal state
  const [submitModal, setSubmitModal]       = useState<{ campaignId: string; campaignTitle: string } | null>(null);
  const [submitUrl, setSubmitUrl]           = useState('');
  const [submitPlatform, setSubmitPlatform] = useState<'YOUTUBE' | 'INSTAGRAM'>('YOUTUBE');
  const [submitting, setSubmitting]         = useState(false);
  const [submitError, setSubmitError]       = useState('');
  const [submitSuccess, setSubmitSuccess]   = useState('');

  const [igConnecting, setIgConnecting] = useState(false);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [disconnecting, setDisconnecting]   = useState<string | null>(null);
  const [buildingScore, setBuildingScore]   = useState<string | null>(null);
  const [scoreErrors, setScoreErrors]       = useState<Record<string, string>>({});
  const [igError, setIgError] = useState('');
  const [ytError, setYtError] = useState('');

  const [ytChannelInput, setYtChannelInput] = useState('');
  const [ytImporting, setYtImporting]       = useState(false);

  const igPopupRef = useRef<Window | null>(null);
  const ytPopupRef = useRef<Window | null>(null);

  const refreshProfile = () => getCreatorProfile().then(p => setProfile(p.data)).catch(() => {});

  const loadPortalDashboard = () => {
    setPortalLoading(true);
    getCreatorPortalDashboard()
      .then(r => setPortalDashboard(r.data))
      .catch(() => {})
      .finally(() => setPortalLoading(false));
  };

  const loadAccounts = (autoScore = false) =>
    getConnectedAccounts().then(r => {
      const all: any[] = r.data;
      setIgAccounts(all.filter(a => a.platform === 'INSTAGRAM'));
      setYtAccounts(all.filter(a => a.platform === 'YOUTUBE'));
      if (autoScore) {
        const missing = all.filter(a => a.trustScore == null);
        if (missing.length > 0) {
          missing.forEach(a => setBuildingScore(prev => prev ?? a.id));
          Promise.allSettled(missing.map(a => rebuildAccountTrustScore(a.id)))
            .then(results => {
              const errs: Record<string, string> = {};
              results.forEach((res, i) => {
                if (res.status === 'rejected') {
                  errs[missing[i].id] = res.reason?.response?.data?.error || res.reason?.message || 'Failed';
                }
              });
              setScoreErrors(prev => ({ ...prev, ...errs }));
              return getConnectedAccounts().then(r2 => {
                const a2: any[] = r2.data;
                setIgAccounts(a2.filter(a => a.platform === 'INSTAGRAM'));
                setYtAccounts(a2.filter(a => a.platform === 'YOUTUBE'));
                setBuildingScore(null);
              });
            })
            .catch(() => setBuildingScore(null));
        }
      }
    }).catch(() => {});

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading]);

  useEffect(() => {
    if (user) {
      refreshProfile();
      getCreatorAnalytics().then(r => setAnalytics(r.data)).catch(() => {});
      getWalletBalance().then(r => setWallet(r.data)).catch(() => {});
      getMyApplications().then(r => setApplications(r.data)).catch(() => {});
      loadAccounts(true);
      loadPortalDashboard();
    }
  }, [user]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;
      if (e.data.type === 'instagram-connect-result') {
        igPopupRef.current?.close();
        const result = typeof e.data.payload === 'string' ? JSON.parse(e.data.payload) : e.data.payload;
        if (result?.ok) {
          setIgConnecting(true); setIgError('');
          rebuildInstagramConnectedBaseline()
            .then(() => { loadAccounts(); refreshProfile(); })
            .catch(err => setIgError(err.response?.data?.error || 'Failed to build baseline'))
            .finally(() => setIgConnecting(false));
        } else { setIgError(result?.error || 'Instagram connection failed'); setIgConnecting(false); }
      }
      if (e.data.type === 'youtube-connect-result') {
        ytPopupRef.current?.close();
        const result = typeof e.data.payload === 'string' ? JSON.parse(e.data.payload) : e.data.payload;
        if (result?.ok) {
          setYtConnecting(true); setYtError('');
          rebuildYouTubeConnectedBaseline()
            .then(() => { loadAccounts(); refreshProfile(); })
            .catch(err => setYtError(err.response?.data?.error || 'Failed to build baseline'))
            .finally(() => setYtConnecting(false));
        } else { setYtError(result?.error || 'YouTube connection failed'); setYtConnecting(false); }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const connectInstagram = async () => {
    setIgError(''); setIgConnecting(true);
    try { const { data } = await getInstagramOAuthUrl(); igPopupRef.current = window.open(data.authUrl, 'instagram-oauth', 'width=600,height=700,left=400,top=100'); }
    catch { setIgError('Could not start Instagram connection'); setIgConnecting(false); }
  };

  const connectYouTube = async () => {
    setYtError(''); setYtConnecting(true);
    try { const { data } = await getYouTubeOAuthUrl(); ytPopupRef.current = window.open(data.authUrl, 'youtube-oauth', 'width=600,height=700,left=400,top=100'); }
    catch { setYtError('Could not start YouTube connection'); setYtConnecting(false); }
  };

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try { await disconnectAccount(accountId); await loadAccounts(); }
    catch (err: any) {
      const account = [...igAccounts, ...ytAccounts].find(a => a.id === accountId);
      if (account?.platform === 'INSTAGRAM') setIgError(err.response?.data?.error || 'Failed to disconnect');
      else setYtError(err.response?.data?.error || 'Failed to disconnect');
    } finally { setDisconnecting(null); }
  };

  const handleBuildScore = async (accountId: string, platform: string) => {
    setBuildingScore(accountId);
    setScoreErrors(prev => { const n = { ...prev }; delete n[accountId]; return n; });
    try { await rebuildAccountTrustScore(accountId); await loadAccounts(); refreshProfile(); }
    catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Failed to build score';
      setScoreErrors(prev => ({ ...prev, [accountId]: msg }));
      if (platform === 'INSTAGRAM') setIgError(msg); else setYtError(msg);
    } finally { setBuildingScore(null); }
  };

  const importYtLive = async () => {
    if (!ytChannelInput.trim()) return;
    setYtImporting(true); setYtError('');
    try { await rebuildYouTubeLiveBaseline(ytChannelInput.trim()); setYtChannelInput(''); refreshProfile(); }
    catch (err: any) { setYtError(err.response?.data?.error || 'Failed to import baseline'); }
    finally { setYtImporting(false); }
  };

  const openSubmitModal = (campaignId: string, campaignTitle: string) => {
    setSubmitModal({ campaignId, campaignTitle });
    setSubmitUrl(''); setSubmitPlatform('YOUTUBE');
    setSubmitError(''); setSubmitSuccess('');
  };

  const handleSubmitVideo = async () => {
    if (!submitModal || !submitUrl.trim()) return;
    setSubmitting(true); setSubmitError(''); setSubmitSuccess('');
    try {
      await submitToCreatorPortalCampaign({
        campaignId: submitModal.campaignId,
        platform: submitPlatform,
        contentUrl: submitUrl.trim(),
      });
      setSubmitSuccess('Submission received! Tracking will begin shortly.');
      setSubmitUrl('');
      loadPortalDashboard();
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="h-5 w-5 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );

  // Always compute reputation score client-side from the accounts in state
  const allAccounts = [...igAccounts, ...ytAccounts];
  const scoredAccounts = allAccounts.filter(a => a.trustScore != null);
  const liveReputationScore =
    scoredAccounts.length > 0
      ? scoredAccounts.reduce((sum, a) => sum + a.trustScore, 0) / scoredAccounts.length
      : null;

  const initials = (profile?.displayName || user?.email || 'U').slice(0, 2).toUpperCase();
  const summary = portalDashboard?.summary;
  const submissions: any[] = portalDashboard?.submissions ?? [];
  const campaigns: any[] = portalDashboard?.campaigns ?? [];
  const walletHistory: any[] = portalDashboard?.walletHistory ?? [];

  return (
    <div className="min-h-screen bg-black text-white">

      {/* ── Navbar ── */}
      <nav className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-lg font-bold tracking-tight">Benchmrk</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/discover')}
            className="text-sm text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-zinc-900"
          >
            Discover
          </button>
          <div className="w-px h-4 bg-zinc-800" />
          <button
            onClick={logout}
            className="text-sm text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-zinc-900"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ── Hero / Welcome ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-red-900/30 flex-shrink-0">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold">
                Welcome back, <span className="text-red-400">{profile?.displayName || user?.email}</span>
              </h2>
              <p className="text-zinc-500 text-sm mt-0.5">Here is how you are doing today</p>
            </div>
          </div>
          {liveReputationScore != null && (
            <div className="hidden sm:block">
              <TrustBadge score={liveReputationScore} />
            </div>
          )}
        </div>

        {/* ── Stats grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Balance"
            value={`₹${parseFloat(wallet?.balance || 0).toFixed(2)}`}
            sub="Available to withdraw"
            accent="bg-gradient-to-r from-emerald-600 to-emerald-500"
          />
          <StatCard
            label="Total Earned"
            value={`₹${parseFloat(wallet?.totalEarned || 0).toFixed(2)}`}
            sub="All time earnings"
            accent="bg-gradient-to-r from-blue-600 to-blue-500"
          />
          <StatCard
            label="Submissions"
            value={String(analytics?.totalSubmissions || 0)}
            sub="Content submitted"
            accent="bg-gradient-to-r from-violet-600 to-violet-500"
          />
          <StatCard
            label="Verified Views"
            value={String(analytics?.totalVerifiedViews || 0)}
            sub="Across all campaigns"
            accent="bg-gradient-to-r from-red-600 to-red-500"
          />
        </div>

        {/* ── Earnings ── */}
        {(summary || portalLoading) && (
          <section>
            <SectionHeader title="Earnings" right={
              <p className="text-xs text-zinc-600">Updates after every review sweep</p>
            } />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-hidden hover:border-zinc-700 transition-colors duration-200">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-emerald-600 to-emerald-500" />
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-3">Withdrawable</p>
                <p className="text-2xl font-bold text-white">
                  {portalLoading ? '—' : `₹${(summary?.withdrawableAmount ?? 0).toFixed(2)}`}
                </p>
                <p className="text-xs text-zinc-600 mt-1">Ready to pay out</p>
              </div>
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-hidden hover:border-zinc-700 transition-colors duration-200">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-amber-600 to-amber-500" />
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-3">Pending</p>
                <p className="text-2xl font-bold text-white">
                  {portalLoading ? '—' : `₹${(summary?.pendingAmount ?? 0).toFixed(2)}`}
                </p>
                <p className="text-xs text-zinc-600 mt-1">Awaiting review sweep</p>
              </div>
              <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-hidden hover:border-zinc-700 transition-colors duration-200">
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-blue-600 to-blue-500" />
                <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-3">Lifetime Earned</p>
                <p className="text-2xl font-bold text-white">
                  {portalLoading ? '—' : `₹${(summary?.lifetimeEarned ?? 0).toFixed(2)}`}
                </p>
                <p className="text-xs text-zinc-600 mt-1">All time total</p>
              </div>
            </div>

            {/* Wallet history */}
            {walletHistory.length > 0 && (
              <div className="mt-4 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-zinc-800/80">
                  <p className="text-sm font-medium text-zinc-300">Transaction History</p>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {walletHistory.slice(0, 8).map((entry: any) => (
                    <div key={entry.id} className="px-5 py-3 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">
                          {entry.submission?.campaignTitle ?? entry.notes ?? entry.entryType}
                        </p>
                        <p className="text-xs text-zinc-600 mt-0.5">
                          {entry.entryType === 'RELEASE_TO_AVAILABLE' ? 'Earnings released' : 'Withdrawal'} ·{' '}
                          {new Date(entry.releasedAt || entry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <span className={`text-sm font-semibold flex-shrink-0 ${entry.entryType === 'WITHDRAWAL' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {entry.entryType === 'WITHDRAWAL' ? '-' : '+'}₹{Number(entry.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── My Submissions ── */}
        <section>
          <SectionHeader title="My Submissions" right={
            submissions.length > 0
              ? <p className="text-xs text-zinc-600">{submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
              : null
          } />

          {portalLoading && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 flex items-center justify-center gap-3 text-zinc-500 text-sm">
              <span className="h-4 w-4 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
              Loading submissions…
            </div>
          )}

          {!portalLoading && submissions.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
                  <path d="M15 10l4.553-2.277A1 1 0 0121 8.645v6.71a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">No submissions yet</p>
              <p className="text-zinc-500 text-sm">Pick a campaign below and submit your content URL to start earning</p>
            </div>
          )}

          {!portalLoading && submissions.length > 0 && (
            <div className="space-y-3">
              {submissions.map((sub: any) => (
                <div key={sub.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-medium text-white truncate">{sub.campaignTitle}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {sub.platform === 'INSTAGRAM' ? <InstagramIcon /> : <YouTubeIcon />}
                        <a
                          href={sub.contentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-500 hover:text-red-400 transition-colors truncate max-w-xs"
                        >
                          {sub.contentUrl}
                        </a>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white">₹{sub.projectedValue?.toFixed(2) ?? '0.00'}</p>
                      <p className="text-xs text-zinc-600 mt-0.5">projected</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-3 py-2 text-center">
                      <p className="text-zinc-600 text-xs">Latest Views</p>
                      <p className="text-white text-sm font-semibold mt-0.5">{(sub.latestViews ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-3 py-2 text-center">
                      <p className="text-zinc-600 text-xs">Pending</p>
                      <p className="text-amber-400 text-sm font-semibold mt-0.5">₹{(sub.pendingAmount ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-3 py-2 text-center">
                      <p className="text-zinc-600 text-xs">Withdrawable</p>
                      <p className="text-emerald-400 text-sm font-semibold mt-0.5">₹{(sub.withdrawableAmount ?? 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {sub.latestSnapshotAt && (
                    <p className="text-xs text-zinc-700 mt-2">
                      Last tracked {new Date(sub.latestSnapshotAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Available Campaigns ── */}
        <section>
          <SectionHeader title="Available Campaigns" right={
            <button
              onClick={loadPortalDashboard}
              disabled={portalLoading}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={portalLoading ? 'animate-spin' : ''}>
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          } />

          {!portalLoading && campaigns.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">No live campaigns right now</p>
              <p className="text-zinc-500 text-sm">Check back soon — new campaigns are added regularly</p>
            </div>
          )}

          {campaigns.length > 0 && (
            <div className="space-y-3">
              {campaigns.map((campaign: any) => {
                const budgetPct = campaign.totalBudget > 0
                  ? Math.min((campaign.spentBudget / campaign.totalBudget) * 100, 100)
                  : 0;
                return (
                  <div key={campaign.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="text-sm font-semibold text-white">{campaign.title}</p>
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">{campaign.brandName}</span>
                        </div>
                        {campaign.description && (
                          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{campaign.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-bold text-red-400">₹{campaign.dollarsPerThousandViews?.toFixed(0)}</p>
                        <p className="text-xs text-zinc-600">per 1K views</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-2.5 py-2 text-center">
                        <p className="text-zinc-600 text-xs">Budget Left</p>
                        <p className="text-white text-sm font-semibold mt-0.5">₹{campaign.remainingBudget?.toFixed(0)}</p>
                      </div>
                      <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-2.5 py-2 text-center">
                        <p className="text-zinc-600 text-xs">Min Views</p>
                        <p className="text-white text-sm font-semibold mt-0.5">{(campaign.minimumPayoutViews ?? 0).toLocaleString()}</p>
                      </div>
                      <div className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-2.5 py-2 text-center">
                        <p className="text-zinc-600 text-xs">Max Payout</p>
                        <p className="text-white text-sm font-semibold mt-0.5">₹{campaign.maxPayoutPerSubmission?.toFixed(0)}</p>
                      </div>
                    </div>

                    {/* Budget bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between text-xs text-zinc-600 mb-1">
                        <span>Budget used</span>
                        <span>{budgetPct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-500"
                          style={{ width: `${budgetPct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => openSubmitModal(campaign.id, campaign.title)}
                      className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-red-900/20"
                    >
                      Submit Content
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Connected Platforms ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">Connected Platforms</h3>
            <p className="text-xs text-zinc-600">Trust scores update automatically</p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            {/* Instagram card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors duration-200">
              <div className="px-5 py-3.5 flex items-center justify-between bg-zinc-900 border-b border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <InstagramIcon />
                  <span className="font-semibold text-sm">Instagram</span>
                  {igAccounts.length > 0 && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">{igAccounts.length}</span>
                  )}
                </div>
                <button
                  onClick={connectInstagram}
                  disabled={igConnecting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {igConnecting ? 'Connecting…' : igAccounts.length > 0 ? '+ Add' : 'Connect'}
                </button>
              </div>

              {igAccounts.length > 0 && (
                <div className="divide-y divide-zinc-800/60">
                  {igAccounts.map(account => (
                    <div key={account.id} className="px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium truncate">{account.channelTitle || `@${account.providerAccountId}`}</span>
                            {account.isPrimary && (
                              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md">Primary</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {account.trustScore != null && <TrustBadge score={account.trustScore} />}
                            {account.trustScore == null && (
                              <button
                                onClick={() => handleBuildScore(account.id, 'INSTAGRAM')}
                                disabled={buildingScore === account.id}
                                className="text-xs px-2.5 py-0.5 rounded-full border border-zinc-700 text-zinc-500 hover:border-red-500/50 hover:text-red-400 disabled:opacity-40 transition-all"
                              >
                                {buildingScore === account.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 border border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                                    Computing…
                                  </span>
                                ) : 'Compute Score'}
                              </button>
                            )}
                          </div>
                          {account.subscriberCount != null && (
                            <p className="text-xs text-zinc-600 mt-1">{account.subscriberCount.toLocaleString()} followers</p>
                          )}
                          {scoreErrors[account.id] && (
                            <p className="text-xs text-red-400 mt-1">{scoreErrors[account.id]}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnecting === account.id}
                          className="text-xs px-2.5 py-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all flex-shrink-0"
                        >
                          {disconnecting === account.id ? '…' : 'Remove'}
                        </button>
                      </div>

                      {account.baselineAvgViews != null && (
                        <div className="grid grid-cols-3 gap-1.5 mt-2">
                          {[
                            { label: 'Avg Views', val: Math.round(account.baselineAvgViews).toLocaleString() },
                            { label: 'Engagement', val: `${(account.baselineEngagement * 100).toFixed(1)}%` },
                            ...(account.baselineFollowerCount != null ? [{ label: 'Followers', val: account.baselineFollowerCount.toLocaleString() }] : []),
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-2.5 py-2 text-center">
                              <p className="text-zinc-600 text-xs">{label}</p>
                              <p className="text-white text-sm font-semibold mt-0.5">{val}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {account.trustScore != null && (
                        <button
                          onClick={() => handleBuildScore(account.id, 'INSTAGRAM')}
                          disabled={buildingScore === account.id}
                          className="mt-2.5 text-xs text-zinc-600 hover:text-zinc-400 disabled:opacity-40 transition-colors"
                        >
                          {buildingScore === account.id ? 'Refreshing…' : '↻ Refresh score'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {igAccounts.length === 0 && (
                <div className="px-5 py-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-3">
                    <InstagramIcon />
                  </div>
                  <p className="text-zinc-400 text-sm font-medium mb-1">No Instagram connected</p>
                  <p className="text-zinc-600 text-xs">Connect to set your performance baseline</p>
                  {igError && <p className="text-red-400 text-xs mt-3">{igError}</p>}
                </div>
              )}
              {igError && igAccounts.length > 0 && (
                <p className="text-red-400 text-xs px-5 pb-3">{igError}</p>
              )}
            </div>

            {/* YouTube card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-zinc-700 transition-colors duration-200">
              <div className="px-5 py-3.5 flex items-center justify-between bg-zinc-900 border-b border-zinc-800/80">
                <div className="flex items-center gap-2.5">
                  <YouTubeIcon />
                  <span className="font-semibold text-sm">YouTube</span>
                  {ytAccounts.length > 0 && (
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">{ytAccounts.length}</span>
                  )}
                </div>
                <button
                  onClick={connectYouTube}
                  disabled={ytConnecting}
                  className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {ytConnecting ? 'Connecting…' : ytAccounts.length > 0 ? '+ Add' : 'Connect'}
                </button>
              </div>

              {ytAccounts.length > 0 && (
                <div className="divide-y divide-zinc-800/60">
                  {ytAccounts.map(account => (
                    <div key={account.id} className="px-5 py-4 hover:bg-zinc-800/30 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium truncate">{account.channelTitle || `Channel ${account.providerAccountId}`}</span>
                            {account.isPrimary && (
                              <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md">Primary</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {account.trustScore != null && <TrustBadge score={account.trustScore} />}
                            {account.trustScore == null && (
                              <button
                                onClick={() => handleBuildScore(account.id, 'YOUTUBE')}
                                disabled={buildingScore === account.id}
                                className="text-xs px-2.5 py-0.5 rounded-full border border-zinc-700 text-zinc-500 hover:border-red-500/50 hover:text-red-400 disabled:opacity-40 transition-all"
                              >
                                {buildingScore === account.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className="h-2.5 w-2.5 border border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                                    Computing…
                                  </span>
                                ) : 'Compute Score'}
                              </button>
                            )}
                          </div>
                          {account.subscriberCount != null && (
                            <p className="text-xs text-zinc-600 mt-1">{account.subscriberCount.toLocaleString()} subscribers</p>
                          )}
                          {scoreErrors[account.id] && (
                            <p className="text-xs text-red-400 mt-1">{scoreErrors[account.id]}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDisconnect(account.id)}
                          disabled={disconnecting === account.id}
                          className="text-xs px-2.5 py-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all flex-shrink-0"
                        >
                          {disconnecting === account.id ? '…' : 'Remove'}
                        </button>
                      </div>

                      {account.baselineAvgViews != null && (
                        <div className="grid grid-cols-3 gap-1.5 mt-2">
                          {[
                            { label: 'Avg Views', val: Math.round(account.baselineAvgViews).toLocaleString() },
                            { label: 'Engagement', val: `${(account.baselineEngagement * 100).toFixed(1)}%` },
                            ...(account.baselineFollowerCount != null ? [{ label: 'Subscribers', val: account.baselineFollowerCount.toLocaleString() }] : []),
                          ].map(({ label, val }) => (
                            <div key={label} className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-2.5 py-2 text-center">
                              <p className="text-zinc-600 text-xs">{label}</p>
                              <p className="text-white text-sm font-semibold mt-0.5">{val}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {account.trustScore != null && (
                        <button
                          onClick={() => handleBuildScore(account.id, 'YOUTUBE')}
                          disabled={buildingScore === account.id}
                          className="mt-2.5 text-xs text-zinc-600 hover:text-zinc-400 disabled:opacity-40 transition-colors"
                        >
                          {buildingScore === account.id ? 'Refreshing…' : '↻ Refresh score'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {ytAccounts.length === 0 && (
                <div className="px-5 py-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <YouTubeIcon />
                    </div>
                  </div>
                  <p className="text-zinc-400 text-sm font-medium text-center mb-1">No YouTube connected</p>
                  <p className="text-zinc-600 text-xs text-center mb-4">Connect via OAuth or import by channel handle</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ytChannelInput}
                      onChange={e => setYtChannelInput(e.target.value)}
                      placeholder="@handle or channel URL"
                      className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm placeholder-zinc-600 text-white focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                    <button
                      onClick={importYtLive}
                      disabled={!ytChannelInput.trim() || ytImporting}
                      className="text-xs px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      {ytImporting ? 'Importing…' : 'Import'}
                    </button>
                  </div>
                  {ytError && <p className="text-red-400 text-xs mt-3">{ytError}</p>}
                </div>
              )}
              {ytError && ytAccounts.length > 0 && (
                <p className="text-red-400 text-xs px-5 pb-3">{ytError}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── My Applications ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">My Applications</h3>
            <button
              onClick={() => router.push('/discover')}
              className="text-sm text-red-400 hover:text-red-300 transition-colors font-medium"
            >
              Browse Campaigns →
            </button>
          </div>

          {applications.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800 flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-zinc-600">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <p className="text-white font-semibold mb-1">No applications yet</p>
              <p className="text-zinc-500 text-sm mb-6">Browse campaigns and start earning from your audience</p>
              <button
                onClick={() => router.push('/discover')}
                className="bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-2.5 rounded-xl transition-all duration-200 text-sm shadow-lg shadow-red-900/30"
              >
                Discover Campaigns
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {applications.map((app: any) => (
                <div
                  key={app.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center justify-between hover:border-zinc-700 transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{app.campaign.title}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">₹{app.campaign.cpvRate} per verified view</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                    app.status === 'ACCEPTED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    app.status === 'REJECTED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-zinc-800 text-zinc-400 border border-zinc-700'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* ── Submit Content Modal ── */}
      {submitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSubmitModal(null)} />
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
                  placeholder={submitPlatform === 'YOUTUBE' ? 'https://youtube.com/watch?v=...' : 'https://instagram.com/p/...'}
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
                onClick={handleSubmitVideo}
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
