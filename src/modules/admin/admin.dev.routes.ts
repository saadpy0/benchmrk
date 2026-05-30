import type { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';
const DEV_ADMIN_EMAIL = 'dev-admin@benchmrk.local';

async function ensureDevAdmin() {
  const user = await prisma.user.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: { role: 'ADMIN' },
    create: {
      email: DEV_ADMIN_EMAIL,
      passwordHash: 'dev-only-admin-login',
      role: 'ADMIN',
    },
  });

  return { user };
}

function buildAdminReviewPage() {
  return `<!doctype html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Benchmrk Admin — Audit Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              brand: {
                50: '#eef2ff',
                100: '#e0e7ff',
                400: '#818cf8',
                500: '#6366f1',
                600: '#4f46e5',
                700: '#4338ca',
                900: '#312e81',
              },
              dark: {
                800: '#1e293b',
                900: '#0f172a',
                950: '#020617',
              }
            }
          }
        }
      }
    </script>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
      body {
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      ::-webkit-scrollbar-track {
        background: #020617;
      }
      ::-webkit-scrollbar-thumb {
        background: #1e293b;
        border-radius: 999px;
      }
      ::-webkit-scrollbar-thumb:hover {
        background: #334155;
      }
    </style>
  </head>
  <body class="h-full flex flex-col overflow-hidden bg-slate-950">
    <!-- Top Header Navigation Bar -->
    <header class="flex-none flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-6 py-4 backdrop-blur">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 text-white shadow-lg shadow-brand-500/20">
          <i data-lucide="shield" class="h-5.5 w-5.5"></i>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="font-bold text-lg tracking-tight text-white">Benchmrk</h1>
            <span class="rounded bg-brand-500/10 px-1.5 py-0.5 text-2xs font-bold uppercase tracking-wider text-brand-400 border border-brand-500/20">Admin Review Console</span>
          </div>
          <p class="text-xs text-slate-400">Phase 4A Campaign Payout Auditing</p>
        </div>
      </div>

      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 rounded-xl bg-slate-950/60 px-3.5 py-1.5 border border-slate-800/80">
          <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-semibold text-slate-300" id="boot-status">Booting admin user...</span>
        </div>
        <button id="run-sweep-btn" class="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-brand-500/10 transition hover:from-brand-600 hover:to-indigo-700 active:scale-95">
          <i data-lucide="calendar" class="h-4 w-4"></i>
          <span>Run Sweep</span>
        </button>
      </div>
    </header>

    <!-- Main Workspace Grid -->
    <main class="flex-1 grid grid-cols-12 overflow-hidden bg-slate-950">
      
      <!-- Left Sidebar: Filters & Selection Summary -->
      <section class="col-span-3 border-r border-slate-900 bg-slate-900/40 p-5 flex flex-col gap-5 overflow-y-auto">
        <div class="space-y-4">
          <h2 class="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <i data-lucide="sliders" class="h-3.5 w-3.5"></i> Filters & Controls
          </h2>
          
          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-400" for="campaign-filter">Campaign Scope</label>
            <select id="campaign-filter" class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition">
              <option value="">All Campaigns</option>
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-400" for="status-filter">Review Status</label>
            <select id="status-filter" class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-medium text-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition">
              <option value="">All Statuses</option>
              <option value="PENDING_REVIEW" selected>Pending Review</option>
              <option value="MORE_INFO_REQUESTED">More Info Requested</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          
          <div class="pt-2 flex gap-2">
            <button id="refresh-queue-btn" class="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 px-3 py-2.5 text-xs font-bold transition">
              <i data-lucide="refresh-cw" class="h-3.5 w-3.5" id="refresh-icon"></i> Refresh Queue
            </button>
            <button id="clear-selection-btn" class="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20 hover:bg-slate-900/50 hover:border-slate-700 px-3 py-2.5 transition text-slate-400 hover:text-white" title="Clear selection">
              <i data-lucide="x-circle" class="h-4 w-4"></i>
            </button>
          </div>
        </div>

        <hr class="border-slate-900" />

        <!-- Decision Engine Action Pad -->
        <div class="flex-1 flex flex-col gap-4">
          <h2 class="text-xs font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <i data-lucide="check-square" class="h-3.5 w-3.5"></i> Decision Pad
          </h2>

          <div class="space-y-1.5">
            <label class="text-xs font-semibold text-slate-400" for="action-note">Audit Ledger Note</label>
            <textarea id="action-note" placeholder="Provide audit reasoning (e.g. view count validated from secondary analytics, anomalous spikes detected, etc.). Required for Reject or Request Info." class="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-300 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition min-h-[110px] resize-none"></textarea>
          </div>

          <div id="partial-payout-panel" class="hidden rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-xs font-bold text-amber-300">Partial payout</div>
                <div class="text-3xs text-slate-400" id="partial-budget-hint">Use a partial payout up to the remaining campaign budget.</div>
              </div>
              <span class="text-3xs font-bold uppercase tracking-wider text-amber-300" id="partial-max-pill">Max ₹0.00</span>
            </div>
            <div>
              <label class="text-xs font-semibold text-slate-300" for="partial-payout-amount">Partial payout amount</label>
              <input id="partial-payout-amount" type="number" min="0" step="0.01" placeholder="0.00" class="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs font-medium text-slate-300 placeholder-slate-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:outline-none transition" />
            </div>
          </div>

          <div class="space-y-2 mt-auto">
            <button id="verify-btn" disabled class="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-800 text-white font-bold py-3 px-4 text-xs tracking-wide shadow-lg shadow-emerald-500/10 transition active:scale-95">
              <i data-lucide="check-circle" class="h-4 w-4"></i> Verify Views & Pay Out
            </button>
            <button id="partial-verify-btn" disabled class="hidden w-full flex items-center justify-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-800 text-white font-bold py-3 px-4 text-xs tracking-wide transition active:scale-95">
              <i data-lucide="scale" class="h-4 w-4"></i> Pay Partial Amount
            </button>
            <button id="request-info-btn" disabled class="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800 disabled:opacity-30 text-sky-400 font-bold py-3 px-4 text-xs tracking-wide transition active:scale-95">
              <i data-lucide="help-circle" class="h-4 w-4"></i> Ask for More Info
            </button>
            <button id="reject-btn" disabled class="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 disabled:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-800 text-white font-bold py-3 px-4 text-xs tracking-wide transition active:scale-95">
              <i data-lucide="alert-octagon" class="h-4 w-4"></i> Reject Video Submission
            </button>
          </div>
        </div>
      </section>

      <!-- Center Pane: Queue Listing -->
      <section class="col-span-4 border-r border-slate-900 bg-slate-950 p-5 flex flex-col overflow-hidden">
        <div class="flex items-center justify-between mb-4 flex-none">
          <h2 class="font-extrabold text-sm tracking-tight text-white flex items-center gap-2">
            Review Queue <span id="queue-count-badge" class="rounded-full bg-slate-800 px-2 py-0.5 text-2xs font-bold text-slate-400">0</span>
          </h2>
          <span class="text-2xs text-slate-500" id="queue-meta">No batches loaded.</span>
        </div>

        <div id="queue" class="flex-1 overflow-y-auto space-y-3 pr-1">
          <!-- Queue cards render here -->
          <div class="flex h-full flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl">
            <i data-lucide="list-video" class="h-8 w-8 text-slate-600 mb-2"></i>
            <p class="text-xs text-slate-400 font-medium">No submission review batches</p>
            <p class="text-3xs text-slate-600 mt-1 max-w-[200px]">Perform a sweep or create a new test submission on dev tester endpoints.</p>
          </div>
        </div>
      </section>

      <!-- Right Pane: Analysis Board -->
      <section class="col-span-5 bg-slate-900/20 flex flex-col overflow-hidden">
        
        <!-- Tab Selector / Selection Summary -->
        <div class="flex-none bg-slate-900/50 border-b border-slate-900/80 px-5 py-3.5 flex items-center justify-between">
          <div class="flex flex-col">
            <span class="text-3xs font-extrabold uppercase tracking-widest text-brand-400">Selected Analysis</span>
            <h3 class="font-bold text-sm text-white max-w-[180px] truncate" id="selection-meta">Select a submission</h3>
          </div>
          <div class="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button id="tab-analytics-btn" class="px-3 py-1.5 rounded-md font-semibold text-slate-400 bg-brand-500/10 text-brand-400 border border-brand-500/20 transition">Metrics</button>
            <button id="tab-signals-btn" class="px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition">Signals</button>
            <button id="tab-raw-btn" class="px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition">JSON</button>
          </div>
        </div>

        <!-- Detail Work Surface -->
        <div class="flex-1 overflow-y-auto p-5" id="detail-surface">
          
          <!-- Empty State -->
          <div id="detail-empty-state" class="flex h-full flex-col items-center justify-center text-center p-6">
            <div class="h-16 w-16 bg-slate-900/80 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-500 mb-4 animate-bounce">
              <i data-lucide="bar-chart-3" class="h-7 w-7 text-brand-400"></i>
            </div>
            <h4 class="font-semibold text-white text-sm mb-1">Visual Video Verdict Audit</h4>
            <p class="text-xs text-slate-400 max-w-[280px]">Select a video card from the review queue to load deep trend metrics, positive/negative signals, and AI recommendations.</p>
          </div>

          <!-- Active State Wrapper -->
          <div id="detail-active-state" class="hidden space-y-5">
            
            <!-- Quick Meta & Badges Row -->
            <div id="detail-pill-container" class="flex flex-wrap gap-2"></div>

            <!-- TAB 1: Analytics & Metrics Dashboard -->
            <div id="tab-analytics-content" class="space-y-4">
              <!-- Info grid -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <span class="text-3xs font-bold uppercase tracking-wider text-slate-500">Incremental Views</span>
                  <span class="text-lg font-extrabold text-white mt-1" id="stat-inc-views">0</span>
                  <span class="text-3xs text-emerald-400 mt-1 flex items-center gap-0.5"><i data-lucide="trending-up" class="h-3 w-3"></i> Validated growth</span>
                </div>
                <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <span class="text-3xs font-bold uppercase tracking-wider text-slate-500">Gross Payout</span>
                  <span class="text-lg font-extrabold text-emerald-400 mt-1" id="stat-payout">$0.00</span>
                  <span class="text-3xs text-slate-500 mt-1" id="stat-cpv">CPV Rate</span>
                </div>
                <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-3.5 flex flex-col justify-between">
                  <span class="text-3xs font-bold uppercase tracking-wider text-slate-500">Risk Score</span>
                  <span class="text-lg font-extrabold mt-1" id="stat-risk">0/100</span>
                  <span class="text-3xs text-slate-500 mt-1" id="stat-risk-label">Low Risk</span>
                </div>
              </div>

              <!-- Metrics Line Chart Card -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4">
                <h3 class="text-xs font-extrabold uppercase tracking-widest text-slate-400 mb-3 flex items-center justify-between">
                  <span>View Count & Growth Trend</span>
                  <span class="text-3xs text-brand-400 font-semibold lowercase">click metrics tab to refresh</span>
                </h3>
                <div class="relative w-full h-[240px]">
                  <canvas id="metricsChart"></canvas>
                </div>
              </div>

              <!-- Sub-Details Checklist -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs">
                <h3 class="text-3xs font-extrabold uppercase tracking-widest text-slate-400 mb-1">Audit Ledger Metadata</h3>
                <div class="grid grid-cols-2 gap-y-2 gap-x-4">
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Creator Account</span> <span class="font-semibold text-slate-300 truncate max-w-[120px]" id="meta-creator-name">—</span></div>
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Submission Date</span> <span class="font-semibold text-slate-300" id="meta-submit-date">—</span></div>
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Audit Range</span> <span class="font-semibold text-slate-300" id="meta-audit-range">—</span></div>
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Earned This Batch</span> <span class="font-semibold text-emerald-400" id="meta-batch-gross">—</span></div>
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Campaign Budget Left</span> <span class="font-semibold text-slate-300" id="meta-budget-remaining">—</span></div>
                  <div class="flex justify-between border-b border-slate-900/50 pb-1.5"><span class="text-slate-500">Budget Status</span> <span class="font-semibold text-slate-300" id="meta-budget-status">—</span></div>
                </div>
                <!-- Dynamic Video URL Box -->
                <div class="pt-2">
                  <span class="text-slate-500">Source Video:</span>
                  <a href="#" target="_blank" id="meta-video-url" class="block font-medium text-brand-400 hover:text-brand-300 hover:underline truncate mt-1">#</a>
                </div>
              </div>
            </div>

            <!-- TAB 2: AI Recommendation, Pros, Cons & Signals -->
            <div id="tab-signals-content" class="space-y-4 hidden">
              <!-- AI Recommendation Card -->
              <div id="rec-card" class="rounded-xl border p-4 flex gap-3.5 items-start">
                <div class="h-8 w-8 rounded-full flex items-center justify-center flex-none" id="rec-icon-bg">
                  <i data-lucide="sparkles" class="h-4.5 w-4.5" id="rec-icon"></i>
                </div>
                <div class="space-y-1">
                  <h4 class="text-xs font-extrabold uppercase tracking-wider" id="rec-title">Verdict Evaluation</h4>
                  <p class="text-xs text-slate-300 leading-relaxed" id="rec-text">Evaluating signals based on recent snapshots...</p>
                  <div class="pt-1.5 flex gap-3 text-3xs font-semibold text-slate-400">
                    <span class="flex items-center gap-1"><i data-lucide="shield-alert" class="h-3 w-3"></i> Confidence: <strong class="text-white" id="rec-conf-val">-%</strong></span>
                    <span class="flex items-center gap-1"><i data-lucide="activity" class="h-3 w-3"></i> Platform: <strong class="text-white" id="rec-platform-val">—</strong></span>
                  </div>
                </div>
              </div>

              <!-- Pros and Cons Section -->
              <div class="grid grid-cols-2 gap-3">
                <!-- Pros (Positive) -->
                <div class="bg-emerald-950/10 border border-emerald-900/30 rounded-xl p-4 space-y-2">
                  <h3 class="text-3xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <i data-lucide="check-circle" class="h-3.5 w-3.5"></i> Audit Pros / Green Signals
                  </h3>
                  <ul class="text-xs space-y-2 text-slate-300" id="detail-pros">
                    <!-- Dynamic Pros -->
                  </ul>
                </div>

                <!-- Cons (Concerns) -->
                <div class="bg-rose-950/10 border border-rose-900/30 rounded-xl p-4 space-y-2">
                  <h3 class="text-3xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <i data-lucide="alert-triangle" class="h-3.5 w-3.5"></i> Audit Cons / Risk Flags
                  </h3>
                  <ul class="text-xs space-y-2 text-slate-300" id="detail-cons">
                    <!-- Dynamic Cons -->
                  </ul>
                </div>
              </div>

              <!-- Review Reasons Section -->
              <div class="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 space-y-2">
                <h3 class="text-3xs font-extrabold uppercase tracking-widest text-slate-400">Underlying Sweep Reason Codes</h3>
                <ul class="text-xs space-y-1.5 text-slate-300" id="detail-reasons">
                  <!-- Dynamic reasons -->
                </ul>
              </div>
            </div>

            <!-- TAB 3: Raw JSON Output -->
            <div id="tab-raw-content" class="space-y-4 hidden">
              <div class="bg-slate-950 border border-slate-900 rounded-xl p-4 relative">
                <span class="absolute top-3 right-3 text-3xs font-bold uppercase text-slate-600">developer debug logs</span>
                <pre class="text-xs text-brand-100 overflow-x-auto whitespace-pre-wrap font-mono h-[320px]" id="output">No response data loaded.</pre>
              </div>
            </div>

          </div>
        </div>
      </section>

    </main>

    <!-- Global Application Script -->
    <script>
      const bootStatus = document.getElementById('boot-status');
      const campaignFilter = document.getElementById('campaign-filter');
      const statusFilter = document.getElementById('status-filter');
      const queueMeta = document.getElementById('queue-meta');
      const queueEl = document.getElementById('queue');
      const queueCountBadge = document.getElementById('queue-count-badge');
      const detailSurface = document.getElementById('detail-surface');
      const detailEmptyState = document.getElementById('detail-empty-state');
      const detailActiveState = document.getElementById('detail-active-state');
      const selectionMeta = document.getElementById('selection-meta');
      const output = document.getElementById('output');
      const actionNote = document.getElementById('action-note');
      const partialPayoutPanel = document.getElementById('partial-payout-panel');
      const partialBudgetHint = document.getElementById('partial-budget-hint');
      const partialMaxPill = document.getElementById('partial-max-pill');
      const partialPayoutAmount = document.getElementById('partial-payout-amount');
      
      const verifyBtn = document.getElementById('verify-btn');
      const partialVerifyBtn = document.getElementById('partial-verify-btn');
      const rejectBtn = document.getElementById('reject-btn');
      const requestInfoBtn = document.getElementById('request-info-btn');
      const runSweepBtn = document.getElementById('run-sweep-btn');
      const refreshQueueBtn = document.getElementById('refresh-queue-btn');
      const clearSelectionBtn = document.getElementById('clear-selection-btn');

      // Right Side Tabs
      const tabAnalyticsBtn = document.getElementById('tab-analytics-btn');
      const tabSignalsBtn = document.getElementById('tab-signals-btn');
      const tabRawBtn = document.getElementById('tab-raw-btn');
      const tabAnalyticsContent = document.getElementById('tab-analytics-content');
      const tabSignalsContent = document.getElementById('tab-signals-content');
      const tabRawContent = document.getElementById('tab-raw-content');

      let authToken = '';
      let queueItems = [];
      let selectedBatchId = '';
      let selectedBatchBudget = null;
      let activeTab = 'analytics';
      let metricsChartInstance = null;

      // Tab switcher event logic
      function switchTab(tab) {
        activeTab = tab;
        [tabAnalyticsBtn, tabSignalsBtn, tabRawBtn].forEach(b => b.className = "px-3 py-1.5 rounded-md font-semibold text-slate-400 hover:text-white transition");
        [tabAnalyticsContent, tabSignalsContent, tabRawContent].forEach(c => c.classList.add('hidden'));

        if (tab === 'analytics') {
          tabAnalyticsBtn.className = "px-3 py-1.5 rounded-md font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 transition";
          tabAnalyticsContent.classList.remove('hidden');
        } else if (tab === 'signals') {
          tabSignalsBtn.className = "px-3 py-1.5 rounded-md font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 transition";
          tabSignalsContent.classList.remove('hidden');
        } else if (tab === 'raw') {
          tabRawBtn.className = "px-3 py-1.5 rounded-md font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 transition";
          tabRawContent.classList.remove('hidden');
        }
      }

      tabAnalyticsBtn.addEventListener('click', () => switchTab('analytics'));
      tabSignalsBtn.addEventListener('click', () => switchTab('signals'));
      tabRawBtn.addEventListener('click', () => switchTab('raw'));

      function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      }

      function formatNumber(value) {
        return typeof value === 'number' ? value.toLocaleString() : Number(value || 0).toLocaleString();
      }

      function formatMoney(value) {
        return '$' + Number(value || 0).toFixed(2);
      }

      function escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function statusBadgeStyle(value) {
        if (value === 'VERIFIED') return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
        if (value === 'REJECTED') return 'bg-rose-500/10 border-rose-500/20 text-rose-400';
        if (value === 'MORE_INFO_REQUESTED') return 'bg-sky-500/10 border-sky-500/20 text-sky-400';
        return 'bg-amber-500/10 border-amber-500/20 text-amber-400';
      }

      function setSelectedBatch(batchId) {
        selectedBatchId = batchId || '';
        const disabled = !selectedBatchId;
        verifyBtn.disabled = disabled;
        partialVerifyBtn.disabled = true;
        rejectBtn.disabled = disabled;
        requestInfoBtn.disabled = disabled;
        renderQueue(queueItems);
      }

      function resetPartialPayoutState() {
        selectedBatchBudget = null;
        partialPayoutPanel.classList.add('hidden');
        partialVerifyBtn.classList.remove('hidden');
        partialVerifyBtn.disabled = true;
        partialPayoutAmount.value = '';
        partialPayoutAmount.removeAttribute('max');
        partialPayoutAmount.removeAttribute('min');
        partialBudgetHint.textContent = 'Use a partial payout up to the remaining campaign budget.';
        partialMaxPill.textContent = 'Max ₹0.00';
      }

      function renderRaw(data) {
        output.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }

      function summarizeReasons(list, isDanger = false) {
        if (!Array.isArray(list) || !list.length) {
          return '<li class="flex items-start gap-2 text-slate-500"><i data-lucide="' + (isDanger ? 'check-circle' : 'info') + '" class="h-4 w-4 text-slate-600 mt-0.5"></i> None detected.</li>';
        }
        return list.map((item) => {
          const icon = isDanger ? 'alert-circle' : 'check-circle';
          const iconColor = isDanger ? 'text-rose-500' : 'text-emerald-500';
          return '<li class="flex items-start gap-2 leading-relaxed"><i data-lucide="' + icon + '" class="' + iconColor + ' h-4 w-4 mt-0.5 flex-none"></i><span>' + escapeHtml(item) + '</span></li>';
        }).join('');
      }

      function drawMetricsChart(snapshots) {
        const ctx = document.getElementById('metricsChart');
        if (!ctx) return;

        // Destroy pre-existing instances to prevent rendering overlay bugs
        if (metricsChartInstance) {
          metricsChartInstance.destroy();
          metricsChartInstance = null;
        }

        if (!Array.isArray(snapshots) || !snapshots.length) {
          return;
        }

        // Parse and sort snapshot objects
        const sorted = [...snapshots].sort((a, b) => new Date(a.capturedAt) - new Date(b.capturedAt));
        const labels = sorted.map(s => {
          const d = new Date(s.capturedAt);
          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        });
        
        const viewsData = sorted.map(s => Number(s.viewCount || 0));
        const engagementData = sorted.map(s => Number(s.likeCount || 0) + Number(s.commentCount || 0));

        // Create Chart with Dual Axis visual configuration
        metricsChartInstance = new Chart(ctx, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [
              {
                label: 'Cumulative Views',
                data: viewsData,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                borderWidth: 2.5,
                tension: 0.35,
                fill: true,
                yAxisID: 'yViews',
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#6366f1'
              },
              {
                label: 'Engagement (Likes + Comments)',
                data: engagementData,
                borderColor: '#14b8a6',
                backgroundColor: 'rgba(20, 184, 166, 0.03)',
                borderWidth: 1.5,
                borderDash: [4, 4],
                tension: 0.2,
                fill: false,
                yAxisID: 'yEngage',
                pointRadius: 2,
                pointHoverRadius: 4,
                pointBackgroundColor: '#14b8a6'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'top',
                labels: {
                  color: '#94a3b8',
                  font: { size: 10, weight: 'bold', family: 'Plus Jakarta Sans' },
                  boxWidth: 12
                }
              },
              tooltip: {
                backgroundColor: '#0f172a',
                titleColor: '#ffffff',
                bodyColor: '#e2e8f0',
                borderColor: '#334155',
                borderWidth: 1,
                padding: 10,
                titleFont: { family: 'Plus Jakarta Sans', weight: 'bold' },
                bodyFont: { family: 'Plus Jakarta Sans' }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: '#64748b', font: { size: 9, family: 'Plus Jakarta Sans' }, maxTicksLimit: 6 }
              },
              yViews: {
                type: 'linear',
                position: 'left',
                grid: { color: 'rgba(51, 65, 85, 0.25)' },
                ticks: { color: '#94a3b8', font: { size: 9, family: 'Plus Jakarta Sans' } },
                title: { display: true, text: 'Total Views', color: '#6366f1', font: { size: 10, weight: 'bold' } }
              },
              yEngage: {
                type: 'linear',
                position: 'right',
                grid: { drawOnChartArea: false }, // Avoid duplicate grid lines
                ticks: { color: '#94a3b8', font: { size: 9, family: 'Plus Jakarta Sans' } },
                title: { display: true, text: 'Likes/Comments', color: '#14b8a6', font: { size: 10, weight: 'bold' } }
              }
            }
          }
        });
      }

      function renderDetail(data) {
        if (!data || !data.batch) {
          detailEmptyState.classList.remove('hidden');
          detailActiveState.classList.add('hidden');
          selectionMeta.textContent = 'Select a submission';
          resetPartialPayoutState();
          return;
        }

        detailEmptyState.classList.add('hidden');
        detailActiveState.classList.remove('hidden');

        const batch = data.batch;
        const tracking = data.tracking || {};
        const budget = data.budget || {};
        const submission = tracking.submission || {};
        const reviewSignals = tracking.reviewSignals || {};
        const snapshots = tracking.snapshots || [];
        const latestSnapshot = snapshots[snapshots.length - 1] || {};

        selectionMeta.textContent = submission.creator?.displayName || batch.submission?.creator?.displayName || 'Unknown Creator';

        // Render Pill Badges
        const pills = [
          '<span class="rounded-lg border px-2.5 py-1 text-2xs font-bold uppercase tracking-wider ' + statusBadgeStyle(batch.status) + '">' + escapeHtml(batch.status) + '</span>',
          '<span class="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-2xs font-bold text-slate-300">Cycle ' + escapeHtml(batch.cycleNumber) + '</span>',
          '<span class="rounded-lg border border-slate-800 bg-slate-900/40 px-2.5 py-1 text-2xs font-bold text-slate-300">Platform: ' + escapeHtml(submission.platform || batch.submission?.platform || '—') + '</span>',
        ];
        document.getElementById('detail-pill-container').innerHTML = pills.join('');

        // Populate Tab 1: Analytics
        document.getElementById('stat-inc-views').textContent = formatNumber(batch.incrementalViews);
        document.getElementById('stat-payout').textContent = '$' + Number(batch.grossAmount).toFixed(2);
        
        const cpv = submission.campaign?.cpvRate || batch.campaign?.cpvRate || 0;
        document.getElementById('stat-cpv').textContent = 'CPV Rate: $' + Number(cpv).toFixed(3);

        const risk = reviewSignals.riskScore || 0;
        const confidence = reviewSignals.confidenceScore || 0;
        document.getElementById('stat-risk').textContent = risk + '/100';
        
        let riskLabel = 'Low Risk';
        let riskColor = 'text-emerald-400';
        if (risk > 60) {
          riskLabel = 'High Risk Alert';
          riskColor = 'text-rose-400';
        } else if (risk > 30) {
          riskLabel = 'Medium Risk';
          riskColor = 'text-amber-400';
        }
        document.getElementById('stat-risk-label').textContent = riskLabel;
        document.getElementById('stat-risk-label').className = 'text-3xs mt-1 font-bold ' + riskColor;

        // Metadata grid
        document.getElementById('meta-creator-name').textContent = submission.creator?.displayName || batch.submission?.creator?.displayName || '—';
        document.getElementById('meta-submit-date').textContent = formatDate(submission.createdAt || batch.submission?.createdAt);
        document.getElementById('meta-audit-range').innerHTML = formatNumber(batch.lockedFromViews) + ' &rarr; ' + formatNumber(batch.lockedToViews);
        document.getElementById('meta-batch-gross').textContent = formatMoney(batch.grossAmount);
        document.getElementById('meta-budget-remaining').textContent = formatMoney(budget.remainingBudgetForBatch || 0);
        document.getElementById('meta-budget-status').textContent = budget.isExhausted
          ? 'Exhausted'
          : budget.isUnderfunded
            ? 'Underfunded'
            : 'Covered';
        
        const videoAnchor = document.getElementById('meta-video-url');
        const videoUrl = submission.contentUrl || batch.submission?.contentUrl || '#';
        videoAnchor.href = videoUrl;
        videoAnchor.textContent = videoUrl;

        resetPartialPayoutState();
        if (batch.status === 'PENDING_REVIEW') {
          selectedBatchBudget = budget;
          partialPayoutPanel.classList.remove('hidden');
          partialVerifyBtn.disabled = Number(budget.remainingBudgetForBatch || 0) <= 0;
          partialPayoutAmount.value = Number(Math.min(Number(budget.remainingBudgetForBatch || 0), Number(budget.requestedAmount || 0))).toFixed(2);
          partialPayoutAmount.min = '0.01';
          partialPayoutAmount.max = String(Number(budget.remainingBudgetForBatch || 0).toFixed(2));
          partialBudgetHint.textContent = budget.isUnderfunded
            ? 'Requested ' + formatMoney(budget.requestedAmount || 0) + ' but only ' + formatMoney(budget.remainingBudgetForBatch || 0) + ' remains in this campaign.'
            : budget.isExhausted
              ? 'This campaign has no remaining budget, so no partial payout can be made.'
              : 'Requested ' + formatMoney(budget.requestedAmount || 0) + '. You can partially release any amount up to ' + formatMoney(budget.remainingBudgetForBatch || 0) + '.';
          partialMaxPill.textContent = 'Max ' + formatMoney(budget.remainingBudgetForBatch || 0);
          verifyBtn.disabled = false;
        }

        // Populate Tab 2: Signals
        document.getElementById('rec-conf-val').textContent = confidence + '%';
        document.getElementById('rec-platform-val').textContent = String(submission.platform || batch.submission?.platform || '—').toUpperCase();

        const recCard = document.getElementById('rec-card');
        const recIconBg = document.getElementById('rec-icon-bg');
        const recIcon = document.getElementById('rec-icon');
        const recTitle = document.getElementById('rec-title');
        const recText = document.getElementById('rec-text');

        // Professional audit verdict engine
        if (batch.status !== 'PENDING_REVIEW') {
          recCard.className = "rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex gap-3.5 items-start";
          recIconBg.className = "h-8 w-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center flex-none";
          recIcon.setAttribute('data-lucide', 'archive');
          recTitle.textContent = "Audit Record Finalized";
          recTitle.className = "text-xs font-extrabold uppercase tracking-wider text-slate-400";
          recText.textContent = "This batch has already been resolved as " + batch.status + ". Ledger changes are finalized and locked.";
        } else if (risk > 65) {
          recCard.className = "rounded-xl border border-rose-950/25 bg-rose-950/10 p-4 flex gap-3.5 items-start";
          recIconBg.className = "h-8 w-8 rounded-full bg-rose-900/20 text-rose-400 flex items-center justify-center flex-none";
          recIcon.setAttribute('data-lucide', 'alert-triangle');
          recTitle.textContent = "Recommended: Reject Submission";
          recTitle.className = "text-xs font-extrabold uppercase tracking-wider text-rose-400";
          recText.textContent = "High anomalous metrics flagged during sweep. The views growth has violated standard safety patterns. Recommend rejecting the batch or requesting a full analytics clip from the creator.";
        } else if (risk > 30 || confidence < 50) {
          recCard.className = "rounded-xl border border-amber-950/25 bg-amber-950/10 p-4 flex gap-3.5 items-start";
          recIconBg.className = "h-8 w-8 rounded-full bg-amber-900/20 text-amber-400 flex items-center justify-center flex-none";
          recIcon.setAttribute('data-lucide', 'help-circle');
          recTitle.textContent = "Recommended: Ask for More Info";
          recTitle.className = "text-xs font-extrabold uppercase tracking-wider text-amber-400";
          recText.textContent = "The platform API returned slightly atypical metrics, or snapshot density is low. Request supporting social analytics screenshots from the creator before finalizing payout.";
        } else {
          recCard.className = "rounded-xl border border-emerald-950/25 bg-emerald-950/10 p-4 flex gap-3.5 items-start";
          recIconBg.className = "h-8 w-8 rounded-full bg-emerald-900/20 text-emerald-400 flex items-center justify-center flex-none";
          recIcon.setAttribute('data-lucide', 'check-circle-2');
          recTitle.textContent = "Recommended: Safe to Pay Out";
          recTitle.className = "text-xs font-extrabold uppercase tracking-wider text-emerald-400";
          recText.textContent = "Anomalies check passed. View counts align perfectly with natural audience growth behaviors. Feel free to authorize and settle the balance to the creator wallet.";
        }

        // Render Lists
        document.getElementById('detail-reasons').innerHTML = summarizeReasons(reviewSignals.reasons, true);
        document.getElementById('detail-pros').innerHTML = summarizeReasons(reviewSignals.positiveSignals || ["Natural consistent view growth", "Creator KYC is healthy"], false);
        document.getElementById('detail-cons').innerHTML = summarizeReasons(reviewSignals.concerns || (risk > 30 ? ["Atypical growth interval flagged"] : []), true);

        // Draw Chart.js Visualization
        drawMetricsChart(snapshots);

        // Mount Lucide icons to dynamic contents
        lucide.createIcons();
      }

      function renderQueue(items) {
        queueItems = Array.isArray(items) ? items : [];
        queueCountBadge.textContent = queueItems.length;

        if (!queueItems.length) {
          queueMeta.textContent = "0 review batches.";
          queueEl.innerHTML = [
            '<div class="flex h-full flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-2xl">',
            '<i data-lucide="list-video" class="h-8 w-8 text-slate-600 mb-2"></i>',
            '<p class="text-xs text-slate-400 font-medium">No results found</p>',
            '<p class="text-3xs text-slate-600 mt-1 max-w-[200px]">Adjust filters or trigger a fresh sweep once campaigns are old enough for review.</p>',
            '</div>'
          ].join('');
          lucide.createIcons();
          if (!selectedBatchId) {
            renderDetail(null);
          }
          return;
        }

        queueMeta.textContent = "Showing " + queueItems.length + " items";

        queueEl.innerHTML = queueItems.map((item) => {
          const batch = item.batch || {};
          const tracking = item.tracking || {};
          const submission = tracking.submission || {};
          const reviewSignals = tracking.reviewSignals || {};
          const isSelected = batch.id === selectedBatchId;
          const cardClass = isSelected
            ? 'border-brand-500 bg-brand-500/5 shadow-md shadow-brand-500/5 ring-1 ring-brand-500'
            : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/30 bg-slate-900/20';

          const risk = reviewSignals.riskScore || 0;
          let riskColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
          if (risk > 60) riskColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
          else if (risk > 30) riskColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';

          return [
            '<div class="rounded-xl border p-4 cursor-pointer transition flex flex-col gap-3 card-item ' + cardClass + '" data-batch-id="' + escapeHtml(batch.id) + '">',
            '  <div class="flex items-start justify-between">',
            '    <div class="space-y-0.5">',
            '      <h3 class="font-bold text-xs text-white line-clamp-1">' + escapeHtml(submission.campaign?.title || batch.campaign?.title || 'Untitled Campaign') + '</h3>',
            '      <p class="text-2xs text-slate-400">by ' + escapeHtml(submission.creator?.displayName || batch.submission?.creator?.displayName || 'Unknown Creator') + '</p>',
            '    </div>',
            '    <span class="rounded-md border px-1.5 py-0.5 text-3xs font-bold uppercase tracking-wider ' + statusBadgeStyle(batch.status) + '">' + escapeHtml(batch.status) + '</span>',
            '  </div>',
            
            '  <div class="grid grid-cols-2 gap-2 text-3xs border-t border-b border-slate-900/50 py-2 my-1 text-slate-400">',
            '    <div><span class="block text-slate-500">Incremental Views</span><strong class="text-white font-semibold">' + formatNumber(batch.incrementalViews) + '</strong></div>',
            '    <div><span class="block text-slate-500">Gross Earnings</span><strong class="text-emerald-400 font-semibold">$' + Number(batch.grossAmount).toFixed(2) + '</strong></div>',
            '  </div>',

            '  <div class="flex items-center justify-between mt-0.5">',
            '    <span class="rounded border px-1.5 py-0.5 text-3xs font-bold ' + riskColor + '">Risk ' + risk + '/100</span>',
            '    <span class="text-3xs text-slate-500 flex items-center gap-1">',
            '      <i data-lucide="eye" class="h-3.5 w-3.5"></i> ' + String(submission.platform || batch.submission?.platform || '—').toUpperCase() + '',
            '    </span>',
            '  </div>',
            '</div>'
          ].join('');
        }).join('');

        // Card select listeners
        queueEl.querySelectorAll('.card-item').forEach((card) => {
          card.addEventListener('click', async () => {
            const batchId = card.getAttribute('data-batch-id');
            if (!batchId) return;
            setSelectedBatch(batchId);
            await loadBatch(batchId);
          });
        });

        lucide.createIcons();
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
        renderRaw(data);
        if (!response.ok) {
          throw new Error((data && data.error) || 'Request failed');
        }
        return data;
      }

      async function bootstrap() {
        const data = await api('/dev/phase4/admin-review/bootstrap', {
          method: 'POST',
          body: JSON.stringify({}),
        });
        authToken = data.token;
        bootStatus.textContent = 'Admin: ' + data.user.email;
        await loadCampaigns();
      }

      async function loadCampaigns() {
        try {
          const campaigns = await api('/campaigns');
          campaignFilter.innerHTML = '<option value="">All Campaigns</option>';
          if (Array.isArray(campaigns)) {
            campaigns.forEach(c => {
              const opt = document.createElement('option');
              opt.value = c.id;
              opt.textContent = c.title + ' (' + c.status + ')';
              campaignFilter.appendChild(opt);
            });
          }
        } catch (err) {
          console.error('Failed to load campaigns selector:', err);
        }
      }

      async function loadQueue() {
        const refreshIcon = document.getElementById('refresh-icon');
        if (refreshIcon) refreshIcon.classList.add('animate-spin');

        const params = new URLSearchParams();
        if (campaignFilter.value.trim()) params.set('campaignId', campaignFilter.value.trim());
        if (statusFilter.value) params.set('status', statusFilter.value);
        const query = params.toString();
        
        try {
          const data = await api('/admin/review-batches' + (query ? '?' + query : ''));
          renderQueue(data);
        } catch (err) {
          console.error(err);
        } finally {
          if (refreshIcon) refreshIcon.classList.remove('animate-spin');
        }
      }

      async function loadBatch(batchId) {
        const data = await api('/admin/review-batches/' + encodeURIComponent(batchId));
        renderDetail(data);
      }

      async function runSweep() {
        const campaignId = campaignFilter.value;
        await api('/admin/review-batches/sweep', {
          method: 'POST',
          body: JSON.stringify(campaignId ? { campaignId } : {}),
        });
        await loadQueue();
      }

      async function runAction(action) {
        if (!selectedBatchId) return;
        const note = actionNote.value.trim();
        const body = note ? { action, note } : { action };
        
        if ((action === 'REJECT' || action === 'REQUEST_MORE_INFO') && !note) {
          alert('Ledger audit note is required when rejecting or requesting additional information!');
          return;
        }

        if (action === 'PARTIAL_VERIFY') {
          const amount = Number(partialPayoutAmount.value || 0);
          const max = Number(selectedBatchBudget?.remainingBudgetForBatch || 0);
          const requested = Number(selectedBatchBudget?.requestedAmount || 0);
          if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid partial payout amount first.');
            return;
          }
          if (amount > max) {
            alert('Partial payout cannot exceed the remaining campaign budget.');
            return;
          }
          if (amount > requested) {
            alert('Partial payout cannot exceed the requested batch amount.');
            return;
          }
          body.amount = amount;
        }

        await api('/admin/review-batches/' + encodeURIComponent(selectedBatchId), {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        actionNote.value = '';
        await loadQueue();
        await loadBatch(selectedBatchId);
      }

      function handleError(error) {
        bootStatus.textContent = error && error.message ? error.message : 'Request failed';
        bootStatus.className = 'text-xs font-semibold text-rose-400';
      }

      runSweepBtn.addEventListener('click', () => {
        runSweepBtn.disabled = true;
        runSweep().catch(handleError).finally(() => runSweepBtn.disabled = false);
      });
      refreshQueueBtn.addEventListener('click', () => loadQueue().catch(handleError));
      
      campaignFilter.addEventListener('change', () => loadQueue().catch(handleError));
      statusFilter.addEventListener('change', () => loadQueue().catch(handleError));

      clearSelectionBtn.addEventListener('click', () => {
        setSelectedBatch('');
        renderDetail(null);
      });

      verifyBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to verify views up until this snapshot and execute ledger payout? This will credit the creator balance wallet.')) {
          runAction('VERIFY').catch(handleError);
        }
      });

      partialVerifyBtn.addEventListener('click', () => {
        const amount = Number(partialPayoutAmount.value || 0);
        if (confirm('Approve a partial payout of ' + formatMoney(amount) + ' for this batch?')) {
          runAction('PARTIAL_VERIFY').catch(handleError);
        }
      });
      
      rejectBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to reject this submission batch? This will cancel the payout incremental views. A note is required.')) {
          runAction('REJECT').catch(handleError);
        }
      });
      
      requestInfoBtn.addEventListener('click', () => {
        runAction('REQUEST_MORE_INFO').catch(handleError);
      });

      bootstrap().then(loadQueue).catch(handleError);
    </script>
  </body>
</html>`;
}

export async function adminDevRoutes(app: FastifyInstance) {
  app.get('/dev/phase4/admin-review', async (_request, reply) => {
    return reply.type('text/html').send(buildAdminReviewPage());
  });

  app.post('/dev/phase4/admin-review/bootstrap', async (_request, reply) => {
    try {
      const { user } = await ensureDevAdmin();
      const token = jwt.sign({ userId: user.id, role: 'ADMIN' }, JWT_SECRET, { expiresIn: '7d' });

      return reply.send({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }
  });
}
