'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getCreatorProfile,
  getInstagramOAuthUrl,
  getYouTubeOAuthUrl,
  getConnectedAccounts,
  disconnectAccount,
  rebuildAccountTrustScore,
  rebuildInstagramConnectedBaseline,
  rebuildYouTubeConnectedBaseline,
  rebuildYouTubeLiveBaseline,
  getCreatorPortalDashboard,
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

  const [profile, setProfile] = useState<any>(null);

  const [igAccounts, setIgAccounts] = useState<any[]>([]);
  const [ytAccounts, setYtAccounts] = useState<any[]>([]);

  // creator portal data
  const [portalDashboard, setPortalDashboard]   = useState<any>(null);
  const [portalLoading, setPortalLoading]       = useState(false);

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

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard
            label="Withdrawable"
            value={portalLoading ? '—' : `₹${(summary?.withdrawableAmount ?? 0).toFixed(2)}`}
            sub="Ready to pay out"
            accent="bg-gradient-to-r from-emerald-600 to-emerald-500"
          />
          <StatCard
            label="Pending"
            value={portalLoading ? '—' : `₹${(summary?.pendingAmount ?? 0).toFixed(2)}`}
            sub="Awaiting review sweep"
            accent="bg-gradient-to-r from-amber-600 to-amber-500"
          />
          <StatCard
            label="Lifetime Earned"
            value={portalLoading ? '—' : `₹${(summary?.lifetimeEarned ?? 0).toFixed(2)}`}
            sub="All time total"
            accent="bg-gradient-to-r from-blue-600 to-blue-500"
          />
          <StatCard
            label="Submissions"
            value={String(summary?.totalSubmissions || 0)}
            sub="Content submitted"
            accent="bg-gradient-to-r from-violet-600 to-violet-500"
          />
          <StatCard
            label="Verified Views"
            value={Number(summary?.totalVerifiedViews || 0).toLocaleString()}
            sub="Across all campaigns"
            accent="bg-gradient-to-r from-red-600 to-red-500"
          />
        </div>

        {/* ── Transaction History ── */}
        {walletHistory.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
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
              <p className="text-zinc-500 text-sm">Browse campaigns and submit your content URL to start earning</p>
              <button
                onClick={() => router.push('/discover')}
                className="mt-4 bg-red-600 hover:bg-red-500 text-white font-semibold px-5 py-2 rounded-xl text-sm transition-all shadow-lg shadow-red-900/30"
              >
                Browse Campaigns
              </button>
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

      </div>

    </div>
  );
}
