'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getBrandProfile, getBrandAnalytics, createCampaign } from '@/lib/api';

export default function BrandDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    guidelines: '',
    cpvRate: '',
    totalBudget: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      getBrandProfile().then(r => setProfile(r.data)).catch(() => {});
      getBrandAnalytics().then(r => setAnalytics(r.data)).catch(() => {});
    }
  }, [user]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createCampaign({
        ...form,
        cpvRate: parseFloat(form.cpvRate),
        totalBudget: parseFloat(form.totalBudget),
      });
      setMessage('Campaign created and submitted for review');
      setShowForm(false);
      getBrandAnalytics().then(r => setAnalytics(r.data)).catch(() => {});
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to create campaign');
    }
  };

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Benchmrk</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => setShowForm(true)} className="bg-white text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-zinc-200 transition">New Campaign</button>
          <button onClick={logout} className="text-zinc-400 hover:text-white transition text-sm">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome, {profile?.companyName || user?.email}</h2>
          <p className="text-zinc-400 mt-1">Manage your campaigns</p>
        </div>

        {message && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm mb-6">
            {message}
          </div>
        )}

        {/* stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Total Campaigns</p>
            <p className="text-2xl font-bold">{analytics?.totalCampaigns || 0}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Verified Views</p>
            <p className="text-2xl font-bold">{analytics?.totalVerifiedViews || 0}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Total Spent</p>
            <p className="text-2xl font-bold">Rs {parseFloat(analytics?.totalSpent || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* campaigns list */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Your Campaigns</h3>
          {!analytics?.campaigns?.length ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-400 mb-4">No campaigns yet</p>
              <button onClick={() => setShowForm(true)} className="bg-white text-black font-semibold px-6 py-2 rounded-lg hover:bg-zinc-200 transition">
                Create Your First Campaign
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {analytics.campaigns.map((c: any) => (
                <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold">{c.title}</h4>
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                      c.status === 'LIVE' ? 'bg-green-500/20 text-green-400' :
                      c.status === 'PENDING_REVIEW' ? 'bg-yellow-500/20 text-yellow-400' :
                      c.status === 'DRAFT' ? 'bg-zinc-700 text-zinc-300' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-zinc-400">
                    <span>Rs {c.cpvRate} per view</span>
                    <span>{c.applications} applications</span>
                    <span>{c.submissions} submissions</span>
                    <span>{c.verifiedViews} verified views</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* create campaign modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center px-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Create Campaign</h3>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleCreateCampaign} className="space-y-4">
              <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Campaign Title</label>
                <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Description</label>
                <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white h-24 resize-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Content Guidelines</label>
                <textarea value={form.guidelines} onChange={e => setForm({...form, guidelines: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white h-24 resize-none" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">CPV Rate (Rs)</label>
                  <input type="number" step="0.01" value={form.cpvRate} onChange={e => setForm({...form, cpvRate: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Total Budget (Rs)</label>
                  <input type="number" value={form.totalBudget} onChange={e => setForm({...form, totalBudget: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Start Date</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">End Date</label>
                  <input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-white" required />
                </div>
              </div>
              <button type="submit" className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-zinc-200 transition">
                Submit for Review
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
