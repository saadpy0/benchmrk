import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/auth.js';
import {
  getCreatorPortalDashboard,
  getCreatorPortalSession,
  listCreatorPortalCampaigns,
  loginCreatorPortal,
  runCreatorPortalDueTracking,
  signupCreatorPortal,
  submitCreatorPortalVideo,
} from './creator.portal.service.js';

const page = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Benchmrk Creator Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              brand: {
                50: '#f0f5ff',
                100: '#e0ebff',
                500: '#3b82f6',
                600: '#2563eb',
                900: '#1e3a8a',
              },
              dark: {
                950: '#030712',
                900: '#0b0f19',
                800: '#111827',
                700: '#1f2937',
                600: '#374151',
              }
            },
            fontFamily: {
              sans: ['Inter', 'system-ui', 'sans-serif'],
            }
          }
        }
      }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
      body {
        font-family: 'Inter', sans-serif;
      }
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: #030712;
      }
      ::-webkit-scrollbar-thumb {
        background: #1f2937;
        border-radius: 9999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #374151;
      }
    </style>
  </head>
  <body class="bg-dark-950 text-slate-100 min-h-screen antialiased flex flex-col selection:bg-brand-500/30 selection:text-blue-200">
    <!-- Top Navbar -->
    <header class="border-b border-dark-800/80 bg-dark-950/80 backdrop-blur-md sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <i data-lucide="sparkles" class="h-4.5 w-4.5 text-white"></i>
          </div>
          <div>
            <span class="text-sm font-black uppercase tracking-wider text-white">Benchmrk</span>
            <span class="text-[10px] font-bold text-slate-500 block -mt-1 tracking-widest uppercase">Creator Portal</span>
          </div>
        </div>

        <!-- Logged In Controls -->
        <div class="flex items-center gap-2">
          <button id="refresh-dashboard-btn" class="hidden inline-flex items-center gap-1.5 rounded-xl border border-dark-800 bg-dark-900/60 hover:bg-dark-800 px-4 py-2 text-xs font-semibold text-slate-300 transition duration-150 active:scale-95">
            <i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i> Refresh
          </button>
          <button id="run-due-btn" class="hidden inline-flex items-center gap-1.5 rounded-xl border border-dark-800/60 bg-dark-900/40 hover:bg-dark-850 px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition duration-150 active:scale-95">
            <i data-lucide="activity" class="h-3.5 w-3.5"></i> Run Sync
          </button>
          <button id="logout-btn" class="hidden inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 px-4 py-2 text-xs font-semibold text-red-400 transition duration-150 active:scale-95">
            <i data-lucide="log-out" class="h-3.5 w-3.5"></i> Exit
          </button>
        </div>
      </div>
    </header>

    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
      
      <!-- Auth Screen -->
      <section id="auth-view" class="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 my-auto py-12">
        <!-- Signup Form -->
        <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 justify-between">
          <div>
            <div class="h-10 w-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 mb-4">
              <i data-lucide="user-plus" class="h-5 w-5"></i>
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight">Create Creator Account</h2>
            <p class="text-xs text-slate-400 mt-1">Join Benchmrk to monetize your views across YouTube and Instagram.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Display Name</label>
              <input id="signup-display-name" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="Your creator name" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Email</label>
              <input id="signup-email" type="email" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="you@example.com" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Password</label>
              <input id="signup-password" type="password" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="Minimum 8 characters" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Bio</label>
              <textarea id="signup-bio" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-650 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition min-h-[80px]" placeholder="Tell brands about your audience and style..."></textarea>
            </div>
          </div>

          <button id="signup-btn" class="w-full mt-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-sm transition duration-150 active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/10">
            <i data-lucide="sparkles" class="h-4 w-4"></i> Get Started
          </button>
        </div>

        <!-- Login Form -->
        <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 md:p-8 shadow-2xl flex flex-col gap-5 justify-between">
          <div>
            <div class="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4">
              <i data-lucide="key" class="h-5 w-5"></i>
            </div>
            <h2 class="text-xl font-bold text-white tracking-tight">Welcome Back</h2>
            <p class="text-xs text-slate-400 mt-1">Log in to view campaigns, request payouts, and check your history.</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Email</label>
              <input id="login-email" type="email" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-655 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="you@example.com" />
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-400 block mb-1.5">Password</label>
              <input id="login-password" type="password" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-655 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="Your password" />
            </div>
          </div>

          <button id="login-btn" class="w-full mt-4 bg-slate-100 hover:bg-white text-dark-950 font-bold py-3 px-4 rounded-xl text-sm transition duration-150 active:scale-95 flex items-center justify-center gap-1.5">
            <i data-lucide="log-in" class="h-4 w-4"></i> Access Portal
          </button>
          
          <p class="text-[10px] text-slate-500 text-center leading-relaxed">By logging in, you access secure creator tools. Benchmrk aggregates view tracking and locks incremental payouts securely to your blockchain or fiat settlement wallet.</p>
        </div>
      </section>

      <!-- Creator Dashboard Screen (Initially Hidden) -->
      <section id="dashboard-view" class="hidden flex flex-col gap-8">
        
        <!-- Profile Card -->
        <div class="bg-gradient-to-r from-dark-900 via-dark-900 to-brand-900/10 border border-dark-800/80 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_120%,rgba(59,130,246,0.08),transparent_50%)]"></div>
          
          <div class="flex items-center gap-4 relative z-10">
            <div class="h-16 w-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-violet-500 p-0.5 shadow-lg">
              <div class="h-full w-full bg-dark-900 rounded-[14px] flex items-center justify-center font-bold text-xl text-white tracking-wider" id="avatar-fallback">
                CR
              </div>
            </div>
            <div class="space-y-1">
              <div class="flex items-center gap-2.5 flex-wrap">
                <h2 class="text-xl font-bold text-white tracking-tight" id="creator-name">Creator Dashboard</h2>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase" id="creator-kyc">KYC: Verified</span>
              </div>
              <p id="creator-subtitle" class="text-xs text-slate-400 font-medium leading-relaxed max-w-xl"></p>
            </div>
          </div>
          
          <div class="flex flex-col gap-1.5 text-left md:text-right relative z-10 shrink-0">
            <span class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">Platform Reputation</span>
            <div class="text-2xl font-black text-white" id="reputation-score-text">0.00</div>
            <span class="text-[10px] text-slate-400" id="projected-value-hint">Projected value: ₹0.00</span>
          </div>
        </div>

        <!-- Core Numbers -->
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-5 shadow-sm hover:border-dark-700 transition duration-150">
            <div class="flex items-center justify-between text-slate-500">
              <span class="text-[10px] font-extrabold uppercase tracking-widest">Pending</span>
              <div class="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                <i data-lucide="clock" class="h-4 w-4"></i>
              </div>
            </div>
            <div class="text-2xl font-black text-white mt-3" id="pending-amount">₹0</div>
            <span class="text-[9px] text-slate-500 mt-1 block">Accumulating views</span>
          </div>

          <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-5 shadow-sm hover:border-dark-700 transition duration-150">
            <div class="flex items-center justify-between text-slate-500">
              <span class="text-[10px] font-extrabold uppercase tracking-widest">Withdrawable</span>
              <div class="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <i data-lucide="wallet" class="h-4 w-4"></i>
              </div>
            </div>
            <div class="text-2xl font-black text-emerald-400 mt-3" id="withdrawable-amount">₹0</div>
            <span class="text-[9px] text-slate-500 mt-1 block">Ready to withdraw</span>
          </div>

          <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-5 shadow-sm hover:border-dark-700 transition duration-150">
            <div class="flex items-center justify-between text-slate-500">
              <span class="text-[10px] font-extrabold uppercase tracking-widest">Lifetime Earned</span>
              <div class="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <i data-lucide="line-chart" class="h-4 w-4"></i>
              </div>
            </div>
            <div class="text-2xl font-black text-white mt-3" id="lifetime-earned">₹0</div>
            <span class="text-[9px] text-slate-500 mt-1 block">Finalized earnings</span>
          </div>

          <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-5 shadow-sm hover:border-dark-700 transition duration-150">
            <div class="flex items-center justify-between text-slate-500">
              <span class="text-[10px] font-extrabold uppercase tracking-widest">Submissions</span>
              <div class="h-7 w-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <i data-lucide="video" class="h-4 w-4"></i>
              </div>
            </div>
            <div class="text-2xl font-black text-white mt-3" id="submission-count">0</div>
            <span class="text-[9px] text-slate-500 mt-1 block">Total videos posted</span>
          </div>

          <div class="bg-dark-900 border border-dark-800/80 rounded-2xl p-5 shadow-sm hover:border-dark-700 transition duration-150 col-span-2 lg:col-span-1">
            <div class="flex items-center justify-between text-slate-500">
              <span class="text-[10px] font-extrabold uppercase tracking-widest">Tracked Views</span>
              <div class="h-7 w-7 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                <i data-lucide="eye" class="h-4 w-4"></i>
              </div>
            </div>
            <div class="text-2xl font-black text-white mt-3" id="tracked-views">0</div>
            <span class="text-[9px] text-slate-500 mt-1 block">Latest combined views</span>
          </div>
        </div>

        <!-- Two Column Workspace -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          <!-- Left Column (Submissions & History) -->
          <div class="lg:col-span-8 flex flex-col gap-8">
            
            <!-- Submissions -->
            <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div class="flex items-center justify-between border-b border-dark-800 pb-3">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="video" class="h-4 w-4 text-brand-500"></i> Your Submissions
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">Track views, pending balances, and verified withdrawable earnings.</p>
                </div>
              </div>
              <div id="submission-list" class="space-y-4">
                <!-- Submissions render here -->
              </div>
            </section>

            <!-- Wallet History -->
            <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div class="flex items-center justify-between border-b border-dark-800 pb-3">
                <div>
                  <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i data-lucide="history" class="h-4 w-4 text-brand-500"></i> Wallet / Account History
                  </h3>
                  <p class="text-xs text-slate-400 mt-0.5">Finalized ledger payouts and withdrawal movements.</p>
                </div>
              </div>
              <div id="wallet-history-list" class="space-y-4">
                <!-- History renders here -->
              </div>
            </section>

          </div>

          <!-- Right Column (Forms & Campaigns) -->
          <div class="lg:col-span-4 flex flex-col gap-8">
            
            <!-- Submit Form -->
            <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div>
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <i data-lucide="plus-circle" class="h-4 w-4 text-brand-500"></i> Submit Video
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">Enter your video or reel link for view monetization.</p>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="text-xs font-semibold text-slate-400 block mb-1.5">Campaign</label>
                  <select id="submission-campaign" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-xs font-medium text-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition"></select>
                </div>
                <div>
                  <label class="text-xs font-semibold text-slate-400 block mb-1.5">Platform</label>
                  <select id="submission-platform" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-xs font-medium text-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition">
                    <option value="YOUTUBE">YouTube</option>
                    <option value="INSTAGRAM">Instagram</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold text-slate-400 block mb-1.5">Video URL</label>
                  <input id="submission-url" class="w-full rounded-xl border border-dark-800 bg-dark-950 px-3.5 py-2.5 text-xs font-medium text-slate-200 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" placeholder="https://youtube.com/watch?v=..." />
                </div>
              </div>

              <button id="submit-video-btn" class="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold py-3 px-4 rounded-xl text-xs transition duration-150 active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-brand-500/10">
                <i data-lucide="upload-cloud" class="h-4 w-4"></i> Submit Video Link
              </button>
              
              <div class="rounded-xl bg-dark-950 border border-dark-800/60 p-3 text-[10px] text-slate-500 leading-relaxed">
                An accepted brand application is auto-created behind the scenes so your video tracking starts immediately.
              </div>
            </section>

            <!-- Instagram Sync Connection -->
            <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
              <div>
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <i data-lucide="instagram" class="h-4 w-4 text-brand-500"></i> Instagram Connection
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">Integrate your professional IG account for real-time tracking.</p>
              </div>

              <div class="rounded-xl bg-dark-950 border border-dark-800 p-4">
                <div class="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 mb-1.5">Connection Status</div>
                <p class="text-xs text-slate-300 font-medium leading-relaxed" id="instagram-connection-status">Checking connection...</p>
              </div>

              <div class="flex flex-col gap-2">
                <button id="instagram-connect-btn" class="w-full bg-dark-950 hover:bg-dark-800 border border-dark-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition duration-150 active:scale-95 flex items-center justify-center gap-1.5">
                  <i data-lucide="link" class="h-3.5 w-3.5"></i> Connect Instagram
                </button>
                <button id="instagram-baseline-btn" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition duration-150 active:scale-95 flex items-center justify-center gap-1.5">
                  <i data-lucide="refresh-cw" class="h-3.5 w-3.5"></i> Rebuild Baseline
                </button>
              </div>
            </section>

            <!-- Campaigns List -->
            <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
              <div class="border-b border-dark-800 pb-3">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                  <i data-lucide="award" class="h-4 w-4 text-brand-500"></i> Available Campaigns
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">Participate and earn CPV payouts based on views.</p>
              </div>
              <div id="campaign-list" class="space-y-4">
                <!-- Campaigns render here -->
              </div>
            </section>

          </div>
        </div>
      </section>

      <!-- Activity Log Card (Collapsible style or cleanly tucked) -->
      <section class="bg-dark-900 border border-dark-800/80 rounded-2xl p-6 shadow-sm flex flex-col gap-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <i data-lucide="terminal" class="h-3.5 w-3.5"></i> Dev Diagnostics Console
          </h3>
          <div id="status" class="text-3xs font-semibold uppercase tracking-wider text-slate-400">Ready</div>
        </div>
        <pre id="output" class="bg-dark-950 border border-dark-800 rounded-xl p-4 text-3xs font-mono text-slate-400 leading-relaxed overflow-x-auto max-h-[140px]"></pre>
      </section>
    </main>

    <script>
      const authView = document.getElementById('auth-view');
      const dashboardView = document.getElementById('dashboard-view');
      const refreshDashboardBtn = document.getElementById('refresh-dashboard-btn');
      const runDueBtn = document.getElementById('run-due-btn');
      const logoutBtn = document.getElementById('logout-btn');
      const output = document.getElementById('output');
      const statusEl = document.getElementById('status');
      const campaignSelect = document.getElementById('submission-campaign');
      let authToken = localStorage.getItem('creatorPortalToken') || '';
      let dashboardData = null;

      function setStatus(message, kind = 'info') {
        statusEl.className = 'text-3xs font-bold uppercase tracking-wider ' + (kind === 'error' ? 'text-red-400' : kind === 'success' ? 'text-emerald-400' : 'text-slate-400');
        statusEl.textContent = message;
      }

      function formatCurrency(value) {
        const numeric = Number(value || 0);
        return '₹' + numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      function formatNumber(value) {
        const numeric = Number(value || 0);
        return numeric.toLocaleString();
      }

      function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }

      async function api(path, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (authToken) headers.Authorization = 'Bearer ' + authToken;
        const response = await fetch(path, { ...options, headers });
        const text = await response.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
        output.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        setStatus((options.method || 'GET') + ' ' + path + ' -> ' + response.status, response.ok ? 'success' : 'error');
        if (!response.ok) {
          throw new Error(data?.error || 'Request failed');
        }
        return data;
      }

      function setLoggedIn(isLoggedIn) {
        authView.classList.toggle('hidden', isLoggedIn);
        dashboardView.classList.toggle('hidden', !isLoggedIn);
        refreshDashboardBtn.classList.toggle('hidden', !isLoggedIn);
        runDueBtn.classList.toggle('hidden', !isLoggedIn);
        logoutBtn.classList.toggle('hidden', !isLoggedIn);
      }

      function renderCampaignOptions(campaigns) {
        if (!Array.isArray(campaigns) || campaigns.length === 0) {
          campaignSelect.innerHTML = '<option value="">No available campaigns right now</option>';
          return;
        }
        campaignSelect.innerHTML = campaigns.map((campaign) => {
          return '<option value="' + campaign.id + '">' + campaign.title + ' (Budget remaining: ' + formatCurrency(campaign.remainingBudget) + ')</option>';
        }).join('');
      }

      function renderCampaigns(campaigns) {
        const container = document.getElementById('campaign-list');
        if (!Array.isArray(campaigns) || campaigns.length === 0) {
          container.innerHTML = '<div class="rounded-xl border border-dashed border-dark-800 p-6 text-center text-xs text-slate-500"><i data-lucide="info" class="h-5 w-5 mx-auto mb-1.5 text-slate-600"></i>No available campaigns right now. Exhausted campaigns are automatically removed.</div>';
          renderCampaignOptions([]);
          lucide.createIcons();
          return;
        }

        renderCampaignOptions(campaigns);
        container.innerHTML = campaigns.map((campaign) => {
          const sweepPill = campaign.isSweepEligible ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 'bg-slate-800 text-slate-400 border border-dark-800';
          return [
            '<div class="rounded-xl border border-dark-800/80 bg-dark-900/40 p-4 space-y-3 shadow-2xs hover:border-dark-700 transition">',
            '  <div class="flex items-start justify-between gap-3">',
            '    <div>',
            '      <h4 class="text-xs font-bold text-white tracking-tight">' + escapeHtml(campaign.title) + '</h4>',
            '      <span class="text-[9px] font-semibold text-slate-500 block">' + escapeHtml(campaign.brandName) + '</span>',
            '    </div>',
            '    <span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ' + sweepPill + '">',
            '      Sweep: ' + (campaign.isSweepEligible ? 'Ready' : 'Pending'),
            '    </span>',
            '  </div>',
            '  <p class="text-[11px] text-slate-400 leading-normal line-clamp-2">' + escapeHtml(campaign.description || 'No description provided.') + '</p>',
            '  <div class="grid grid-cols-2 gap-2 text-[10px] bg-dark-950/60 border border-dark-850 p-2.5 rounded-lg">',
            '    <div>',
            '      <span class="text-slate-500 block">Payout Rate</span>',
            '      <span class="font-bold text-white">₹' + Number(campaign.dollarsPerThousandViews || 0).toFixed(2) + ' <span class="text-[8px] font-medium text-slate-500">/ 1k views</span></span>',
            '    </div>',
            '    <div>',
            '      <span class="text-slate-500 block">Remaining Budget</span>',
            '      <span class="font-bold text-emerald-400">' + formatCurrency(campaign.remainingBudget) + '</span>',
            '    </div>',
            '  </div>',
            '</div>'
          ].join('\n');
        }).join('');
        lucide.createIcons();
      }

      function renderSubmissions(submissions) {
        const container = document.getElementById('submission-list');
        if (!Array.isArray(submissions) || submissions.length === 0) {
          container.innerHTML = '<div class="rounded-xl border border-dashed border-dark-800 p-8 text-center text-xs text-slate-500"><i data-lucide="video" class="h-6 w-6 mx-auto mb-2 text-slate-605"></i>No video submissions tracked yet. Choose an available campaign to get started.</div>';
          lucide.createIcons();
          return;
        }

        container.innerHTML = submissions.map((submission) => {
          const statusStyle = submission.status === 'UNDER_REVIEW'
            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            : submission.status === 'VERIFIED'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-slate-800 text-slate-400 border border-dark-800';

          const platformIcon = submission.platform === 'YOUTUBE' ? 'youtube' : 'instagram';

          return [
            '<div class="rounded-xl border border-dark-800/80 bg-dark-900/60 p-5 space-y-4 hover:border-dark-700 transition">',
            '  <div class="flex items-start justify-between gap-4 flex-wrap">',
            '    <div class="space-y-1">',
            '      <div class="flex items-center gap-2 flex-wrap">',
            '        <h4 class="text-xs font-bold text-white tracking-tight">' + escapeHtml(submission.campaignTitle) + '</h4>',
            '        <span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ' + statusStyle + ' border">',
            '          ' + submission.status,
            '        </span>',
            '      </div>',
            '      <div class="flex items-center gap-1.5 text-xs text-slate-500">',
            '        <i data-lucide="' + platformIcon + '" class="h-3.5 w-3.5 ' + (submission.platform === 'YOUTUBE' ? 'text-red-500' : 'text-pink-500') + '"></i>',
            '        <a href="' + submission.contentUrl + '" target="_blank" rel="noreferrer" class="hover:underline hover:text-slate-300 truncate max-w-[280px] font-medium inline-block">' + escapeHtml(submission.contentUrl) + '</a>',
            '      </div>',
            '    </div>',
            '    <div class="text-[10px] text-slate-500 text-right">',
            '      Submitted ' + formatDate(submission.createdAt),
            '    </div>',
            '  </div>',
            '  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 bg-dark-950/45 p-3 rounded-xl border border-dark-850">',
            '    <div>',
            '      <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Current Views</span>',
            '      <span class="text-xs font-bold text-white">' + formatNumber(submission.latestViews) + '</span>',
            '    </div>',
            '    <div>',
            '      <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Verified Views</span>',
            '      <span class="text-xs font-bold text-white">' + formatNumber(submission.verifiedViews) + '</span>',
            '    </div>',
            '    <div>',
            '      <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Pending Balance</span>',
            '      <span class="text-xs font-bold text-slate-300">' + formatCurrency(submission.pendingAmount) + '</span>',
            '    </div>',
            '    <div>',
            '      <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-widest block">Withdrawn / Released</span>',
            '      <span class="text-xs font-bold text-emerald-400">' + formatCurrency(submission.withdrawableAmount) + '</span>',
            '    </div>',
            '  </div>',
            '  <div class="flex items-center justify-between text-[9px] text-slate-500 flex-wrap gap-2">',
            '    <span>Projected gross value: <strong>' + formatCurrency(submission.projectedValue) + '</strong></span>',
            '    <span>Latest snapshot checked: <strong>' + formatDate(submission.latestSnapshotAt) + '</strong></span>',
            '  </div>',
            '</div>'
          ].join('\n');
        }).join('');
        lucide.createIcons();
      }

      function renderWalletHistory(entries) {
        const container = document.getElementById('wallet-history-list');
        if (!Array.isArray(entries) || entries.length === 0) {
          container.innerHTML = '<div class="rounded-xl border border-dashed border-dark-800 p-8 text-center text-xs text-slate-500"><i data-lucide="wallet" class="h-6 w-6 mx-auto mb-2 text-slate-605"></i>No wallet movements recorded yet. Earnings will appear as payments verify.</div>';
          lucide.createIcons();
          return;
        }

        container.innerHTML = entries.map((entry) => {
          const isWithdrawal = entry.entryType === 'WITHDRAWAL';
          const title = isWithdrawal ? 'Withdrawal completed' : 'Earnings finalized';
          const badgeBg = isWithdrawal ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
          const when = entry.releasedAt || entry.createdAt;
          const submissionText = entry.submission
            ? (entry.submission.campaignTitle || 'Campaign') + ' (' + entry.submission.platform + ')'
            : 'Wallet-level entry';

          return [
            '<div class="rounded-xl border border-dark-800 bg-dark-900/40 p-4 space-y-3 hover:border-dark-700 transition">',
            '  <div class="flex items-center justify-between gap-3 flex-wrap">',
            '    <div class="flex items-center gap-2">',
            '      <div class="h-6 w-6 rounded bg-brand-500/10 flex items-center justify-center text-brand-500">',
            '        <i data-lucide="' + (isWithdrawal ? 'send' : 'arrow-down-left') + '" class="h-3.5 w-3.5"></i>',
            '      </div>',
            '      <span class="text-xs font-bold text-white">' + title + '</span>',
            '      <span class="inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold ' + badgeBg + ' border">',
            '        ' + entry.status,
            '      </span>',
            '    </div>',
            '    <span class="text-xs font-bold text-slate-300">' + formatCurrency(entry.amount) + '</span>',
            '  </div>',
            '  <div class="flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">',
            '    <span>Source: <strong class="text-slate-400">' + escapeHtml(submissionText) + '</strong></span>',
            '    <span>Processed: <strong>' + formatDate(when) + '</strong></span>',
            '  </div>',
            (entry.notes ? '  <p class="text-[10px] italic bg-dark-950/45 p-2 rounded border border-dark-850 text-slate-400 leading-normal">' + escapeHtml(entry.notes) + '</p>' : ''),
            '</div>'
          ].join('\n');
        }).join('');
        lucide.createIcons();
      }

      function renderDashboard(data) {
        dashboardData = data;
        document.getElementById('creator-name').textContent = data.creator.displayName + ' Dashboard';
        document.getElementById('creator-subtitle').innerHTML = data.creator.email + (data.creator.bio ? ' <span class="text-slate-600 px-1">•</span> ' + data.creator.bio : '');
        document.getElementById('creator-kyc').textContent = 'KYC: ' + data.creator.kycStatus;
        
        // Generate elegant fallback initials for avatar
        const initials = String(data.creator.displayName || 'CR')
          .split(' ')
          .slice(0, 2)
          .map(word => word[0] || '')
          .join('')
          .toUpperCase();
        document.getElementById('avatar-fallback').textContent = initials;

        // Reputation scoring values
        document.getElementById('reputation-score-text').textContent = Number(data.creator.reputationScore || 0).toFixed(2);
        document.getElementById('projected-value-hint').textContent = 'Projected value: ' + formatCurrency(data.summary.totalProjectedValue);

        // Top statistics counters
        document.getElementById('pending-amount').textContent = formatCurrency(data.summary.pendingAmount);
        document.getElementById('withdrawable-amount').textContent = formatCurrency(data.summary.withdrawableAmount);
        document.getElementById('lifetime-earned').textContent = formatCurrency(data.summary.lifetimeEarned);
        document.getElementById('submission-count').textContent = formatNumber(data.summary.totalSubmissions);
        document.getElementById('tracked-views').textContent = formatNumber(data.summary.totalLatestViews);

        const instagram = data.integrations?.instagram;
        document.getElementById('instagram-connection-status').textContent = instagram?.connected
          ? 'Connected: @' + (instagram.username || 'instagram-account') + ' (' + formatNumber(instagram.followerCount) + ' followers)'
          : 'Instagram not connected yet. Connect your professional account before submitting Instagram videos.';

        renderCampaigns(data.campaigns);
        renderSubmissions(data.submissions);
        renderWalletHistory(data.walletHistory);
      }

      window.addEventListener('message', async (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'instagram-connect-result') {
          output.textContent = typeof event.data.payload === 'string' ? event.data.payload : JSON.stringify(event.data.payload, null, 2);
          await loadDashboard();
        }
      });

      async function loadDashboard() {
        const data = await api('/creator/app/dashboard');
        renderDashboard(data);
      }

      async function restoreSession() {
        if (!authToken) {
          setLoggedIn(false);
          return;
        }

        try {
          await api('/creator/app/session');
          setLoggedIn(true);
          await loadDashboard();
        } catch {
          localStorage.removeItem('creatorPortalToken');
          authToken = '';
          setLoggedIn(false);
        }
      }

      document.getElementById('signup-btn').onclick = async () => {
        const data = await api('/creator/app/signup', {
          method: 'POST',
          body: JSON.stringify({
            displayName: document.getElementById('signup-display-name').value,
            email: document.getElementById('signup-email').value,
            password: document.getElementById('signup-password').value,
            bio: document.getElementById('signup-bio').value,
          }),
        });
        authToken = data.token;
        localStorage.setItem('creatorPortalToken', authToken);
        setLoggedIn(true);
        await loadDashboard();
      };

      document.getElementById('login-btn').onclick = async () => {
        const data = await api('/creator/app/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
          }),
        });
        authToken = data.token;
        localStorage.setItem('creatorPortalToken', authToken);
        setLoggedIn(true);
        await loadDashboard();
      };

      document.getElementById('submit-video-btn').onclick = async () => {
        await api('/creator/app/submissions', {
          method: 'POST',
          body: JSON.stringify({
            campaignId: document.getElementById('submission-campaign').value,
            platform: document.getElementById('submission-platform').value,
            contentUrl: document.getElementById('submission-url').value,
          }),
        });
        document.getElementById('submission-url').value = '';
        await loadDashboard();
      };

      document.getElementById('instagram-connect-btn').onclick = async () => {
        const data = await api('/auth/instagram/start');
        const popup = window.open(data.authUrl, 'instagram-oauth', 'width=520,height=720');
        if (!popup) {
          setStatus('Popup blocked. Allow popups for localhost and try again.', 'error');
        }
      };

      document.getElementById('instagram-baseline-btn').onclick = async () => {
        await api('/creators/baseline/rebuild/instagram-connected', {
          method: 'POST',
          body: JSON.stringify({ maxResults: 12 }),
        });
        await loadDashboard();
      };

      refreshDashboardBtn.onclick = async () => {
        await loadDashboard();
      };

      runDueBtn.onclick = async () => {
        await api('/creator/app/tracking/run-due', {
          method: 'POST',
          body: JSON.stringify({ maxJobs: 10 }),
        });
        await loadDashboard();
      };

      logoutBtn.onclick = () => {
        authToken = '';
        localStorage.removeItem('creatorPortalToken');
        setLoggedIn(false);
        setStatus('Logged out', 'success');
      };

      restoreSession().catch((error) => {
        setStatus(error.message, 'error');
      });
    </script>
  </body>
</html>`;

export async function creatorPortalRoutes(app: FastifyInstance) {
  app.get('/creator/app', async (_request, reply) => {
    return reply.type('text/html').send(page);
  });

  app.post('/creator/app/signup', async (request, reply) => {
    const { email, password, displayName, bio } = request.body as {
      email?: string;
      password?: string;
      displayName?: string;
      bio?: string;
    };

    if (!email?.trim()) {
      return reply.code(400).send({ error: 'email is required' });
    }
    if (!password || password.length < 8) {
      return reply.code(400).send({ error: 'password must be at least 8 characters' });
    }

    try {
      const result = await signupCreatorPortal({
        email,
        password,
        ...(displayName !== undefined ? { displayName } : {}),
        ...(bio !== undefined ? { bio } : {}),
      });
      return reply.code(201).send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/creator/app/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email?.trim() || !password) {
      return reply.code(400).send({ error: 'email and password are required' });
    }

    try {
      const result = await loginCreatorPortal({ email, password });
      return reply.send(result);
    } catch (err: any) {
      return reply.code(401).send({ error: err.message });
    }
  });

  app.get('/creator/app/session', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Creator access only' });
    }

    try {
      const result = await getCreatorPortalSession(request.user.userId);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/creator/app/campaigns', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Creator access only' });
    }

    try {
      const campaigns = await listCreatorPortalCampaigns();
      return reply.send({ campaigns });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.get('/creator/app/dashboard', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Creator access only' });
    }

    try {
      const dashboard = await getCreatorPortalDashboard(request.user.userId);
      return reply.send(dashboard);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/creator/app/submissions', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Creator access only' });
    }

    const { campaignId, platform, contentUrl } = request.body as {
      campaignId?: string;
      platform?: 'YOUTUBE' | 'INSTAGRAM';
      contentUrl?: string;
    };

    if (!campaignId?.trim()) {
      return reply.code(400).send({ error: 'campaignId is required' });
    }
    if (platform !== 'YOUTUBE' && platform !== 'INSTAGRAM') {
      return reply.code(400).send({ error: 'platform must be YOUTUBE or INSTAGRAM' });
    }
    if (!contentUrl?.trim()) {
      return reply.code(400).send({ error: 'contentUrl is required' });
    }

    try {
      const submission = await submitCreatorPortalVideo({
        userId: request.user.userId,
        campaignId,
        platform,
        contentUrl,
      });
      return reply.code(201).send({ ok: true, submission });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });

  app.post('/creator/app/tracking/run-due', { preHandler: authenticate }, async (request, reply) => {
    if (request.user.role !== 'CREATOR') {
      return reply.code(403).send({ error: 'Creator access only' });
    }

    const body = (request.body ?? {}) as { maxJobs?: number };

    try {
      const result = await runCreatorPortalDueTracking(request.user.userId, body.maxJobs ?? 10);
      return reply.send({ ok: true, result });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
