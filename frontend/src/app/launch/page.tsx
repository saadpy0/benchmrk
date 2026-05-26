'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    // load Cal.com embed script
    const script = document.createElement('script');
    script.src = 'https://app.cal.com/embed/embed.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold cursor-pointer" onClick={() => router.push('/')}>Benchmrk</h1>
        <button onClick={() => router.push('/login')} className="text-zinc-400 hover:text-white transition text-sm">Sign In</button>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <span className="bg-white/10 text-white text-xs font-medium px-3 py-1 rounded-full mb-4 inline-block">For Brands</span>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Launch Your Campaign</h1>
          <p className="text-zinc-400 text-lg max-w-xl mx-auto">
            Book a 30-minute call with our team. We will set up your campaign, find the right creators, and get you live within 48 hours.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🎯</div>
            <h3 className="font-semibold mb-2">Performance Based</h3>
            <p className="text-zinc-400 text-sm">You only pay for verified views. No wasted budget on fake engagement.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">🇮🇳</div>
            <h3 className="font-semibold mb-2">India Focused</h3>
            <p className="text-zinc-400 text-sm">Creators across Instagram and YouTube reaching Indian audiences.</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="font-semibold mb-2">Live in 48 Hours</h3>
            <p className="text-zinc-400 text-sm">From call to live campaign in under two days. No long contracts.</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-zinc-800">
            <h2 className="text-xl font-semibold">Book a Campaign Launch Call</h2>
            <p className="text-zinc-400 text-sm mt-1">30 minutes · Google Meet · Free</p>
          </div>
          <div className="p-4">
            <iframe
              src="https://cal.com/benchmrk-xf7tdc/campaign-launch-call?embed=true&theme=dark"
              style={{ width: '100%', height: '600px', border: 'none' }}
              title="Book a Campaign Launch Call"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

