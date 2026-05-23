'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDiscoverCampaigns, applyToCampaign } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Campaign } from '@/types';

export default function DiscoverPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    getDiscoverCampaigns()
      .then(r => setCampaigns(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (id: string) => {
    if (!user) { router.push('/login'); return; }
    setApplying(id);
    try {
      await applyToCampaign(id);
      setMessage('Application submitted!');
    } catch (err: any) {
      setMessage(err.response?.data?.error || 'Failed to apply');
    } finally {
      setApplying(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => router.push('/')}>Benchmrk</h1>
        <div className="flex items-center gap-4">
          {user ? (
            <button onClick={() => router.push(user.role === 'CREATOR' ? '/dashboard/creator' : '/dashboard/brand')} className="text-zinc-400 hover:text-white transition text-sm">Dashboard</button>
          ) : (
            <button onClick={() => router.push('/login')} className="bg-white text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-zinc-200 transition">Sign In</button>
          )}
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Discover Campaigns</h2>
          <p className="text-zinc-400 mt-2">Find campaigns and start earning</p>
        </div>

        {message && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm mb-6">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-zinc-400">Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400">No live campaigns right now. Check back soon.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">{c.title}</h3>
                    <p className="text-zinc-400 text-sm">{c.brand.companyName}</p>
                  </div>
                  <span className="bg-green-500/20 text-green-400 text-xs font-medium px-3 py-1 rounded-full">LIVE</span>
                </div>
                <p className="text-zinc-400 text-sm mb-4 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">Rs {c.cpvRate}</p>
                    <p className="text-zinc-500 text-xs">per view</p>
                  </div>
                  {user?.role === 'CREATOR' && (
                    <button
                      onClick={() => handleApply(c.id)}
                      disabled={applying === c.id}
                      className="bg-white text-black font-semibold px-5 py-2 rounded-lg hover:bg-zinc-200 transition disabled:opacity-50 text-sm"
                    >
                      {applying === c.id ? 'Applying...' : 'Apply Now'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
