'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const [mode, setMode] = useState<'creator' | 'brand'>('creator');
  const router = useRouter();
  const isCreator = mode === 'creator';

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isCreator ? 'bg-[#F5F0E8] text-black' : 'bg-black text-white'}`}>

      {/* navbar */}
      <nav className={`px-6 py-4 flex items-center justify-between border-b ${isCreator ? 'border-zinc-300' : 'border-zinc-800'}`}>
        <h1 className="text-xl font-bold tracking-tight">Benchmrk</h1>

        {/* toggle */}
        <div className={`flex items-center rounded-full p-1 ${isCreator ? 'bg-zinc-200' : 'bg-zinc-900'}`}>
          <button
            onClick={() => setMode('creator')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
              isCreator ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            For Creators
          </button>
          <button
            onClick={() => setMode('brand')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-300 ${
              !isCreator ? 'bg-red-600 text-white' : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            For Brands
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/login')} className={`text-sm font-medium transition ${isCreator ? 'text-zinc-600 hover:text-black' : 'text-zinc-400 hover:text-white'}`}>
            Sign In
          </button>
          <button
            onClick={() => router.push(isCreator ? '/signup' : '/launch')}
            className="bg-red-600 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition"
          >
            {isCreator ? 'Start Earning' : 'Launch Campaign'}
          </button>
        </div>
      </nav>

      {/* hero */}
      <div className="max-w-5xl mx-auto px-6 py-24 text-center">
        {isCreator ? (
          <>
            <span className="inline-block bg-red-600/10 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wider">For Instagram + YouTube Creators</span>
            <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-6">
              Turn Views<br />Into Income
            </h1>
            <p className="text-xl text-zinc-600 max-w-xl mx-auto mb-10">
              Post content for top Indian brands and earn money for every verified view. No minimum followers required.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => router.push('/signup')} className="bg-red-600 text-white font-semibold px-8 py-4 rounded-xl text-lg hover:bg-red-700 transition">
                Start Earning Today
              </button>
              <button onClick={() => router.push('/discover')} className="border border-zinc-300 text-zinc-700 font-semibold px-8 py-4 rounded-xl text-lg hover:border-zinc-400 transition">
                Browse Campaigns
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="inline-block bg-red-600/10 text-red-600 text-xs font-semibold px-3 py-1 rounded-full mb-6 uppercase tracking-wider">For Brands</span>
            <h1 className="text-6xl md:text-7xl font-bold leading-tight mb-6">
              Marketing<br />Powered by India
            </h1>
            <p className="text-xl text-zinc-400 max-w-xl mx-auto mb-10">
              Scale your brand with authentic content from India's top creators. Pay only for verified views — zero waste.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => router.push('/launch')} className="bg-red-600 text-white font-semibold px-8 py-4 rounded-xl text-lg hover:bg-red-700 trsition">
                Launch a Campaign
              </button>
              <button onClick={() => router.push('/discover')} className="border border-zinc-800 text-zinc-400 font-semibold px-8 py-4 rounded-xl text-lg hover:border-zinc-600 transition">
                See Live Campaigns
              </button>
            </div>
          </>
        )}
      </div>

      {/* how it works */}
      <div className={`border-t ${isCreator ? 'border-zinc-200' : 'border-zinc-800'} py-20`}>
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">
            {isCreator ? 'Get Paid in 3 Steps' : 'How It Works'}
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {isCreator ? (
              <>
                <div className={`rounded-2xl p-8 ${isCreator ? 'bg-white border border-zinc-200' : 'bg-zinc-900 border border-zinc-800'}`}>
                  <div className="text-4xl mb-4">📱</div>
                  <h3 className="fonbold text-lg mb-2">1. Browse Campaigns</h3>
                  <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>Find campaigns from brands that match your content style and audience.</p>
                </div>
                <div className={`rounded-2xl p-8 ${isCreator ? 'bg-white border border-zinc-200' : 'bg-zinc-900 border border-zinc-800'}`}>
                  <div className="text-4xl mb-4">🎬</div>
                  <h3 className="font-bold text-lg mb-2">2. Post Your Content</h3>
                  <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>Create and post content following the brand guidelines on Instagram or YouTube.</p>
                </div>
                <div className={`rounded-2xl p-8 ${isCreator ? 'bg-white border border-zinc-200' : 'bg-zinc-900 border border-zinc-800'}`}>
                  <div className="text-4xl mb-4">💸</div>
                  <h3 className="font-bold text-lg mb-2">3. Get Paid</h3>
                  <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>Earn money for every verified view. Withdraw to UPI or bank account anytime.</p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                  <div className="text-4xl mb-4">📞</div>
                  <h3 className="font-bold text-lg mb-2">1. Book a Call</h3>
                  <p className="text-zinc-400 text-sm">Talk to our team. We understand your goals and set up your campaign in 48 hours.</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                  <div className="text-4xl mb-4">🚀</div>
                  <h3 className="font-bold text-lg mb-2">2. Creators Apply</h3>
                  <p className="text-zinc-400 text-sm">Verified Indian creators on Instagram and YouTube apply to your campaign.</p>
                </div>
                <div className="bg-zinc-900der border-zinc-800 rounded-2xl p-8">
                  <div className="text-4xl mb-4">📊</div>
                  <h3 className="font-bold text-lg mb-2">3. Pay Per View</h3>
                  <p className="text-zinc-400 text-sm">Only pay for verified views. Real-time dashboard tracks every rupee spent.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* stats */}
      <div className={`border-t py-16 ${isCreator ? 'border-zinc-200' : 'border-zinc-800'}`}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-5xl font-bold text-red-600 mb-2">₹0.5+</p>
              <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>Per verified view</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-red-600 mb-2">48hr</p>
              <p className={`text-sm ${isCreator ? 'text-zinc-500':'text-zinc-400'}`}>Campaign go-live time</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-red-600 mb-2">100%</p>
              <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>Verified real views</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className={`border-t py-20 ${isCreator ? 'border-zinc-200' : 'border-zinc-800'}`}>
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-4xl font-bold mb-4">
            {isCreator ? 'Ready to start earning?' : 'Ready to scale your brand?'}
          </h2>
          <p className={`mb-8 ${isCreator ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {isCreator ? 'Join creators already earning from their content on Benchmrk.' : 'Join brands already running performance campaigns on Benchmrk.'}
          </p>
          <button
            onClick={() => router.push(isCreator ? '/signup' : '/launch')}
            className="bg-red-600 text-white font-semibold px-10 py-4 rounded-xl text-lg hover:bg-red-700 transition"
          >
            {isCreator ? 'Create Free Account' : 'Book a Call'}
          </button>
        </div>
      </div>

      {/* footer */}
      <div className={`border-t px-6 py-8 ${isCreator ? 'border-zinc-200' : 'border-zinc-800'}`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <p className="font-bold">Benchmrk</p>
          <p className={`text-sm ${isCreator ? 'text-zinc-500' : 'text-zinc-500'}`}>© 2026 Benchmrk. All rights reserved.</p>
          <div className="flex gap-4 text-sm">
            <button onClick={() => router.push('/discover')} className={`transition ${isCreator ? 'text-zinc-500 hover:text-black' : 'text-zinc-500 hover:text-white'}`}>Discover</button>
            <button onClick={() => router.push('/login')} className={`transition ${isCreator ? 'text-zinc-500 hover:text-black' : 'text-zinc-500 hover:text-white'}`}>Login</button>
           <button onClick={() => router.push('/launch')} className={`transition ${isCreator ? 'text-zinc-500 hover:text-black' : 'text-zinc-500 hover:text-white'}`}>Launch Campaign</button>
          </div>
        </div>
      </div>

    </div>
  );
}
