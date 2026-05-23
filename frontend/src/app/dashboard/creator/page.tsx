'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCreatorProfile, getCreatorAnalytics, getWalletBalance, getMyApplications } from '@/lib/api';

export default function CreatorDashboard() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      getCreatorProfile().then(r => setProfile(r.data)).catch(() => {});
      getCreatorAnalytics().then(r => setAnalytics(r.data)).catch(() => {});
      getWalletBalance().then(r => setWallet(r.data)).catch(() => {});
      getMyApplications().then(r => setApplications(r.data)).catch(() => {});
    }
  }, [user]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Benchmrk</h1>
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/discover')} className="text-zinc-400 hover:text-white transition text-sm">Discover</button>
          <button onClick={logout} className="text-zinc-400 hover:text-white transition text-sm">Logout</button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome back, {profile?.displayName || user?.email}</h2>
          <p className="text-zinc-400 mt-1">Here is how you are doing</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Balance</p>
            <p className="text-2xl font-bold">Rs {parseFloat(wallet?.balance || 0).toFixed(2)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Total Earned</p>
            <p className="text-2xl font-bold">Rs {parseFloat(wallet?.totalEarned || 0).toFixed(2)}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Submissions</p>
            <p className="text-2xl font-bold">{analytics?.totalSubmissions || 0}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-zinc-400 text-sm mb-1">Verified Views</p>
            <p className="text-2xl font-bold">{analytics?.totalVerifiedViews || 0}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">My Applications</h3>
            <button onClick={() => router.push('/discover')} className="text-sm text-zinc-400 hover:text-white transition">Browse Campaigns</button>
          </div>

          {applications.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <p className="text-zinc-400 mb-4">You have not applied to any campaigns yet</p>
              <button onClick={() => router.push('/discover')} className="bg-white text-black font-semibold px-6 py-2 rounded-lg hover:bg-zinc-200 transition">
                Discover Campaigns
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map((app: any) => (
                <div key={app.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{app.campaign.title}</p>
                    <p className="text-zinc-400 text-sm">Rs {app.campaign.cpvRate} per view</p>
                  </div>
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    app.status === 'ACCEPTED' ? 'bg-green-500/20 text-green-400' :
                    app.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' :
                    'bg-zinc-700 text-zinc-300'
                  }`}>
                    {app.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
