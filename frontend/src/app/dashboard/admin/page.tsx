'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  getAdminStats,
  getAdminUsers,
  suspendUser,
  getPendingCampaigns,
  approveCampaign,
  rejectCampaign,
  getReviewQueue,
  updateReviewBatch,
  runReviewSweep,
  getAdminBrands,
  createAdminCampaign,
} from '@/lib/api';

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(n: number) { return n.toLocaleString('en-IN'); }
function fmtRupee(n: number) { return `₹${n.toFixed(2)}`; }
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtDateTime(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/* ─── Shared components ──────────────────────────────────────────────────── */

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl p-5 overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-px ${accent}`} />
      <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function SectionHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {right}
    </div>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING_REVIEW:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
    MORE_INFO_REQUESTED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    VERIFIED:            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    REJECTED:            'bg-red-500/10 text-red-400 border-red-500/20',
  };
  const label: Record<string, string> = {
    PENDING_REVIEW: 'Pending Review', MORE_INFO_REQUESTED: 'More Info',
    VERIFIED: 'Verified', REJECTED: 'Rejected',
  };
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${map[status] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
      {label[status] ?? status}
    </span>
  );
}

function PartialVerifyModal({ batch, onClose, onSubmit }: { batch: any; onClose: () => void; onSubmit: (amount: number, note: string) => void }) {
  const max = Number(batch.batch?.grossAmount ?? 0);
  const [amount, setAmount] = useState(String(max));
  const [note, setNote] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-4">Partial Verify</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Amount <span className="text-zinc-600">(max {fmtRupee(max)})</span></label>
            <input type="number" value={amount} min={0} max={max} onChange={e => setAmount(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Note (optional)</label>
            <input type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for partial amount…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 transition-all">Cancel</button>
            <button onClick={() => onSubmit(Number(amount), note)} disabled={!amount || Number(amount) <= 0}
              className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all">Confirm</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Mode: Review Dashboard ─────────────────────────────────────────────── */

function ReviewDashboard({ stats, onStatsRefresh }: { stats: any; onStatsRefresh: () => void }) {
  const [tab, setTab] = useState<'review' | 'campaigns' | 'users'>('review');
  const [queue, setQueue] = useState<any[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilter, setQueueFilter] = useState('');
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [partialBatch, setPartialBatch] = useState<any>(null);
  const [pendingCampaigns, setPendingCampaigns] = useState<any[]>([]);
  const [campaignLoading, setCampaignLoading] = useState(false);
  const [campaignActionLoading, setCampaignActionLoading] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState('');

  const loadQueue = useCallback(() => {
    setQueueLoading(true);
    getReviewQueue(queueFilter ? { status: queueFilter } : undefined)
      .then(r => setQueue(r.data)).catch(() => {}).finally(() => setQueueLoading(false));
  }, [queueFilter]);

  const loadCampaigns = useCallback(() => {
    setCampaignLoading(true);
    getPendingCampaigns().then(r => setPendingCampaigns(r.data)).catch(() => {}).finally(() => setCampaignLoading(false));
  }, []);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    getAdminUsers().then(r => setUsers(r.data)).catch(() => {}).finally(() => setUsersLoading(false));
  }, []);

  useEffect(() => { loadQueue(); loadCampaigns(); }, []);
  useEffect(() => { loadQueue(); }, [queueFilter]);
  useEffect(() => { if (tab === 'users' && users.length === 0) loadUsers(); }, [tab]);

  const handleSweep = async () => {
    setSweeping(true); setSweepMsg('');
    try {
      const r = await runReviewSweep();
      const d = r.data;
      setSweepMsg(`Sweep done — ${d.batchesCreated ?? d.created ?? 0} batch(es) created`);
      loadQueue(); onStatsRefresh();
    } catch (err: any) { setSweepMsg(err.response?.data?.error || 'Sweep failed'); }
    finally { setSweeping(false); }
  };

  const handleBatchAction = async (batchId: string, action: string, extra?: { note?: string; amount?: number }) => {
    setActionLoading(batchId);
    try { await updateReviewBatch(batchId, { action, ...extra }); loadQueue(); onStatsRefresh(); }
    catch (err: any) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setActionLoading(null); }
  };

  const handlePartialVerify = async (amount: number, note: string) => {
    if (!partialBatch) return;
    await handleBatchAction(partialBatch.batch.id, 'PARTIAL_VERIFY', { amount, note: note || undefined });
    setPartialBatch(null);
  };

  const handleCampaignAction = async (id: string, action: 'approve' | 'reject') => {
    setCampaignActionLoading(id);
    try {
      if (action === 'approve') await approveCampaign(id); else await rejectCampaign(id);
      loadCampaigns(); onStatsRefresh();
    } catch (err: any) { alert(err.response?.data?.error || 'Action failed'); }
    finally { setCampaignActionLoading(null); }
  };

  const handleSuspend = async (id: string, email: string) => {
    if (!confirm(`Suspend ${email}? This cannot be undone.`)) return;
    setSuspendingId(id);
    try { await suspendUser(id); loadUsers(); onStatsRefresh(); }
    catch (err: any) { alert(err.response?.data?.error || 'Failed'); }
    finally { setSuspendingId(null); }
  };

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.creatorProfile?.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.brandProfile?.companyName?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const tabs = [
    { id: 'review' as const, label: 'Review Queue', count: queue.filter(q => ['PENDING_REVIEW','MORE_INFO_REQUESTED'].includes(q.batch?.status)).length },
    { id: 'campaigns' as const, label: 'Pending Campaigns', count: pendingCampaigns.length },
    { id: 'users' as const, label: 'Users' },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}>
            {t.label}
            {t.count != null && t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.id ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Review Queue */}
      {tab === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {[{ val: '', label: 'All' }, { val: 'PENDING_REVIEW', label: 'Pending' }, { val: 'MORE_INFO_REQUESTED', label: 'More Info' }, { val: 'VERIFIED', label: 'Verified' }, { val: 'REJECTED', label: 'Rejected' }].map(f => (
                <button key={f.val} onClick={() => setQueueFilter(f.val)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${queueFilter === f.val ? 'bg-zinc-700 text-white' : 'bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              {sweepMsg && <p className="text-xs text-zinc-400">{sweepMsg}</p>}
              <button onClick={handleSweep} disabled={sweeping}
                className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold transition-all shadow-lg shadow-red-900/20">
                {sweeping ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                )}
                {sweeping ? 'Running…' : 'Run Sweep'}
              </button>
            </div>
          </div>

          {queueLoading && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 flex items-center justify-center gap-3 text-zinc-500 text-sm"><span className="h-4 w-4 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />Loading…</div>}

          {!queueLoading && queue.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
              <p className="text-white font-semibold mb-1">Queue is empty</p>
              <p className="text-zinc-500 text-sm">Run a sweep to generate review batches from eligible submissions</p>
            </div>
          )}

          {!queueLoading && queue.map((item: any) => {
            const b = item.batch;
            const isPending = ['PENDING_REVIEW', 'MORE_INFO_REQUESTED'].includes(b.status);
            const isActioning = actionLoading === b.id;
            return (
              <div key={b.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-white truncate">{b.campaign?.title}</p>
                      <BatchStatusBadge status={b.status} />
                    </div>
                    <p className="text-xs text-zinc-500">Creator: <span className="text-zinc-300">{b.submission?.creator?.displayName ?? '—'}</span> · Sweep #{b.cycleNumber ?? '—'} · {fmtDateTime(b.createdAt)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-base font-bold text-white">{fmtRupee(Number(b.grossAmount ?? 0))}</p>
                    <p className="text-xs text-zinc-600">gross</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Incremental Views', val: fmt(Number(b.incrementalViews ?? 0)) },
                    { label: 'Views at Start', val: fmt(Number(b.startViews ?? 0)) },
                    { label: 'Views at End', val: fmt(Number(b.endViews ?? 0)) },
                    { label: 'CPV Rate', val: `₹${(Number(b.campaign?.cpvRate ?? 0) * 1000).toFixed(0)}/K` },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-zinc-800/60 border border-zinc-800 rounded-xl px-3 py-2 text-center">
                      <p className="text-zinc-600 text-xs">{label}</p>
                      <p className="text-white text-sm font-semibold mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
                {b.submission?.contentUrl && (
                  <a href={b.submission.contentUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400 transition-colors mb-4">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {b.submission.contentUrl}
                  </a>
                )}
                {isPending && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleBatchAction(b.id, 'VERIFY')} disabled={isActioning}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 font-medium disabled:opacity-40 transition-all">
                      {isActioning && <span className="h-3 w-3 border border-emerald-500/40 border-t-emerald-400 rounded-full animate-spin" />}Verify
                    </button>
                    <button onClick={() => setPartialBatch(item)} disabled={isActioning}
                      className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 font-medium disabled:opacity-40 transition-all">Partial Verify</button>
                    <button onClick={() => handleBatchAction(b.id, 'REQUEST_MORE_INFO')} disabled={isActioning}
                      className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 font-medium disabled:opacity-40 transition-all">Request Info</button>
                    <button onClick={() => handleBatchAction(b.id, 'REJECT')} disabled={isActioning}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium disabled:opacity-40 transition-all">Reject</button>
                  </div>
                )}
                {item.tracking?.snapshots?.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-zinc-800/60">
                    <p className="text-xs text-zinc-600 mb-2">Tracking snapshots</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {item.tracking.snapshots.slice(0, 5).map((snap: any, i: number) => (
                        <div key={i} className="flex-shrink-0 bg-zinc-800/60 border border-zinc-800 rounded-lg px-3 py-2 text-center min-w-[90px]">
                          <p className="text-white text-xs font-semibold">{fmt(Number(snap.viewCount ?? 0))}</p>
                          <p className="text-zinc-600 text-xs mt-0.5">{fmtDate(snap.capturedAt)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {partialBatch && <PartialVerifyModal batch={partialBatch} onClose={() => setPartialBatch(null)} onSubmit={handlePartialVerify} />}
        </div>
      )}

      {/* Pending Campaigns */}
      {tab === 'campaigns' && (
        <div>
          <SectionHeader title="Pending Campaigns" right={<button onClick={loadCampaigns} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Refresh</button>} />
          {campaignLoading && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 flex items-center justify-center gap-3 text-zinc-500 text-sm"><span className="h-4 w-4 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />Loading…</div>}
          {!campaignLoading && pendingCampaigns.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
              <p className="text-white font-semibold mb-1">No pending campaigns</p>
              <p className="text-zinc-500 text-sm">All campaigns have been reviewed</p>
            </div>
          )}
          {pendingCampaigns.map((campaign: any) => (
            <div key={campaign.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-3 hover:border-zinc-700 transition-colors">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-white">{campaign.title}</p>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded-md">{campaign.brand?.companyName}</span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{campaign.description}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">₹{(Number(campaign.cpvRate ?? 0) * 1000).toFixed(0)}/K views</p>
                  <p className="text-xs text-zinc-600">Budget: ₹{Number(campaign.totalBudget ?? 0).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleCampaignAction(campaign.id, 'approve')} disabled={campaignActionLoading === campaign.id}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white transition-all">
                  {campaignActionLoading === campaign.id ? 'Processing…' : 'Approve'}
                </button>
                <button onClick={() => handleCampaignAction(campaign.id, 'reject')} disabled={campaignActionLoading === campaign.id}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50 text-red-400 transition-all">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div>
          <SectionHeader title="Users" right={
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search…"
              className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-52 transition-colors" />
          } />
          {usersLoading && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 flex items-center justify-center gap-3 text-zinc-500 text-sm"><span className="h-4 w-4 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />Loading…</div>}
          {!usersLoading && filteredUsers.length === 0 && <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center"><p className="text-white font-semibold">No users found</p></div>}
          {!usersLoading && filteredUsers.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="divide-y divide-zinc-800/60">
                {filteredUsers.map((u: any) => (
                  <div key={u.id} className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-zinc-800/30 transition-colors">
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${u.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' : u.role === 'BRAND' ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-700 text-zinc-300'}`}>
                        {(u.creatorProfile?.displayName || u.brandProfile?.companyName || u.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.creatorProfile?.displayName || u.brandProfile?.companyName || u.email}</p>
                        <p className="text-xs text-zinc-600 truncate">{u.email} · {fmtDate(u.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border hidden sm:inline-flex ${u.role === 'ADMIN' ? 'bg-red-500/10 text-red-400 border-red-500/20' : u.role === 'BRAND' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>{u.role}</span>
                      {u.creatorProfile?.reputationScore != null && <p className="text-xs text-zinc-600 hidden sm:block">Score: {u.creatorProfile.reputationScore}</p>}
                      {u.role !== 'ADMIN' && (
                        <button onClick={() => handleSuspend(u.id, u.email)} disabled={suspendingId === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all">
                          {suspendingId === u.id ? '…' : 'Suspend'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Mode: Post Campaign ─────────────────────────────────────────────────── */

function PostCampaignDashboard() {
  const [brands, setBrands] = useState<any[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Today and 30 days from now as defaults
  const today = new Date().toISOString().split('T')[0];
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    brandId: '',
    title: '',
    description: '',
    guidelines: '',
    cpvRate: '',
    totalBudget: '',
    minimumPayoutViews: '1000',
    maxPayoutPerSubmission: '',
    startDate: today,
    endDate: in30,
  });

  useEffect(() => {
    getAdminBrands()
      .then(r => setBrands(r.data))
      .catch(() => {})
      .finally(() => setBrandsLoading(false));
  }, []);

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandId) { setError('Please select a brand'); return; }
    setSubmitting(true); setError(''); setSuccess('');
    try {
      const res = await createAdminCampaign({
        brandId: form.brandId,
        title: form.title,
        description: form.description,
        guidelines: form.guidelines,
        cpvRate: Number(form.cpvRate) / 1000, // convert ₹/1K to per-view rate
        totalBudget: Number(form.totalBudget),
        minimumPayoutViews: Number(form.minimumPayoutViews),
        maxPayoutPerSubmission: Number(form.maxPayoutPerSubmission),
        startDate: form.startDate,
        endDate: form.endDate,
      });
      setSuccess(`Campaign "${res.data.title}" posted and is now LIVE.`);
      setForm(f => ({ ...f, title: '', description: '', guidelines: '', cpvRate: '', totalBudget: '', maxPayoutPerSubmission: '' }));
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to post campaign');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-2xl">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-800/80">
          <h3 className="text-sm font-semibold text-white">Post a Campaign</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Creates a LIVE campaign on behalf of a brand. Visible to creators immediately.</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Brand */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Brand *</label>
            {brandsLoading ? (
              <div className="h-10 bg-zinc-800 border border-zinc-700 rounded-xl animate-pulse" />
            ) : brands.length === 0 ? (
              <p className="text-xs text-zinc-500">No brands found. Brands must sign up and create a profile first.</p>
            ) : (
              <select value={form.brandId} onChange={e => set('brandId', e.target.value)} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors appearance-none">
                <option value="">Select a brand…</option>
                {brands.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.companyName}</option>
                ))}
              </select>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Campaign Title *</label>
            <input type="text" value={form.title} onChange={e => set('title', e.target.value)} required
              placeholder="e.g. Lays Summer Campaign 2026"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors" />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Description *</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} required rows={3}
              placeholder="What is this campaign about?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors resize-none" />
          </div>

          {/* Guidelines */}
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Creator Guidelines *</label>
            <textarea value={form.guidelines} onChange={e => set('guidelines', e.target.value)} required rows={3}
              placeholder="What should creators do? Any dos/don'ts, hashtags, talking points…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors resize-none" />
          </div>

          {/* Payout row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Payout Rate (₹ per 1K views) *</label>
              <input type="number" value={form.cpvRate} onChange={e => set('cpvRate', e.target.value)} required min={0} step="0.01"
                placeholder="e.g. 100"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Total Budget (₹) *</label>
              <input type="number" value={form.totalBudget} onChange={e => set('totalBudget', e.target.value)} required min={0}
                placeholder="e.g. 500000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
          </div>

          {/* Limits row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Min Views per Sweep</label>
              <input type="number" value={form.minimumPayoutViews} onChange={e => set('minimumPayoutViews', e.target.value)} min={0}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Max Payout per Video (₹)</label>
              <input type="number" value={form.maxPayoutPerSubmission} onChange={e => set('maxPayoutPerSubmission', e.target.value)} min={0}
                placeholder="0 = no cap"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">Start Date *</label>
              <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">End Date *</label>
              <input type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors" />
            </div>
          </div>

          {error && <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}
          {success && <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm">{success}</div>}

          <button type="submit" disabled={submitting || brandsLoading}
            className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-red-900/20">
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Posting…
              </span>
            ) : 'Post Campaign'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

type Mode = 'review' | 'post';

export default function AdminDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('review');
  const [stats, setStats] = useState<any>(null);

  const loadStats = useCallback(() => {
    getAdminStats().then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading]);
  useEffect(() => { if (!loading && user && user.role !== 'ADMIN') router.push('/'); }, [user, loading]);
  useEffect(() => { if (user) loadStats(); }, [user]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-400">
        <span className="h-5 w-5 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
        Loading…
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Navbar */}
      <nav className="sticky top-0 z-20 bg-black/80 backdrop-blur-md border-b border-zinc-800/80 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-lg font-bold tracking-tight">Benchmrk</span>
          <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">Admin</span>
        </div>
        <button onClick={logout} className="text-sm text-zinc-400 hover:text-white transition px-3 py-1.5 rounded-lg hover:bg-zinc-900">Logout</button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Users"    value={fmt(stats.totalUsers)}       accent="bg-gradient-to-r from-blue-600 to-blue-500" />
            <StatCard label="Campaigns"      value={fmt(stats.totalCampaigns)}   accent="bg-gradient-to-r from-violet-600 to-violet-500" />
            <StatCard label="Submissions"    value={fmt(stats.totalSubmissions)} accent="bg-gradient-to-r from-amber-600 to-amber-500" />
            <StatCard label="Applications"  value={fmt(stats.totalApplications)} accent="bg-gradient-to-r from-emerald-600 to-emerald-500" />
          </div>
        )}

        {/* ── Mode toggle ── */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 flex gap-1.5 w-fit">
          <button
            onClick={() => setMode('review')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              mode === 'review'
                ? 'bg-zinc-700 text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12h6M9 16h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Review Dashboard
          </button>
          <button
            onClick={() => setMode('post')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              mode === 'post'
                ? 'bg-red-600 text-white shadow-sm shadow-red-900/40'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4v16m8-8H4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Post Campaign
          </button>
        </div>

        {/* Mode content */}
        {mode === 'review' && <ReviewDashboard stats={stats} onStatsRefresh={loadStats} />}
        {mode === 'post'   && <PostCampaignDashboard />}

      </div>
    </div>
  );
}
