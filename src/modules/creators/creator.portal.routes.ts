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
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: #020617; color: #e2e8f0; }
      .wrap { max-width: 1200px; margin: 0 auto; padding: 32px 20px 48px; }
      h1, h2, h3 { margin: 0; }
      p { color: #94a3b8; }
      .hero { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
      .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
      .card { background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0.78)); border: 1px solid #1e293b; border-radius: 18px; padding: 18px; box-shadow: 0 12px 30px rgba(0,0,0,0.25); }
      .muted { color: #94a3b8; }
      .tiny { font-size: 12px; color: #94a3b8; }
      .value { font-size: 28px; font-weight: 700; margin-top: 8px; }
      label { display: block; margin: 10px 0 6px; font-size: 14px; color: #cbd5e1; }
      input, textarea, select, button { width: 100%; box-sizing: border-box; border-radius: 12px; border: 1px solid #334155; background: #0f172a; color: #e2e8f0; padding: 11px 12px; font: inherit; }
      textarea { min-height: 84px; resize: vertical; }
      button { border: none; background: linear-gradient(90deg, #2563eb, #7c3aed); font-weight: 700; cursor: pointer; }
      button.secondary { background: #1e293b; }
      button.ghost { background: transparent; border: 1px solid #334155; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .auth-shell { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
      .hidden { display: none !important; }
      .toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
      .toolbar button { width: auto; padding: 10px 14px; }
      .list { display: grid; gap: 12px; margin-top: 14px; }
      .campaign-item, .submission-item { border: 1px solid #1e293b; border-radius: 16px; padding: 14px; background: rgba(15, 23, 42, 0.72); }
      .history-item { border: 1px solid #1e293b; border-radius: 16px; padding: 14px; background: rgba(15, 23, 42, 0.72); }
      .campaign-meta, .submission-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 12px; }
      .history-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 12px; }
      .meta-block { background: rgba(2, 6, 23, 0.55); border: 1px solid #1e293b; border-radius: 12px; padding: 10px; }
      .meta-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; }
      .meta-value { margin-top: 5px; font-weight: 600; }
      .status { padding: 6px 10px; border-radius: 999px; background: rgba(37, 99, 235, 0.16); color: #bfdbfe; font-size: 12px; font-weight: 700; display: inline-flex; width: fit-content; }
      .success { color: #86efac; }
      .error { color: #fca5a5; }
      .panel-title { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
      .footer-note { margin-top: 10px; font-size: 12px; color: #94a3b8; }
      a { color: #93c5fd; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <div>
          <h1>Creator Portal</h1>
          <p>Sign up or log in as a creator, browse live campaigns, submit your video, and track pending earnings as snapshots update.</p>
        </div>
        <div class="toolbar">
          <button id="refresh-dashboard-btn" class="secondary hidden">Refresh Dashboard</button>
          <button id="run-due-btn" class="ghost hidden">Run Due Tracking</button>
          <button id="logout-btn" class="ghost hidden">Log Out</button>
        </div>
      </section>

      <section id="auth-view" class="auth-shell">
        <div class="card">
          <h2>Create Creator Account</h2>
          <label>Display Name</label>
          <input id="signup-display-name" placeholder="Your creator name" />
          <label>Email</label>
          <input id="signup-email" type="email" placeholder="you@example.com" />
          <label>Password</label>
          <input id="signup-password" type="password" placeholder="Minimum 8 characters" />
          <label>Bio</label>
          <textarea id="signup-bio" placeholder="Tell brands a little about yourself"></textarea>
          <button id="signup-btn">Create Creator Account</button>
        </div>

        <div class="card">
          <h2>Creator Login</h2>
          <label>Email</label>
          <input id="login-email" type="email" placeholder="you@example.com" />
          <label>Password</label>
          <input id="login-password" type="password" placeholder="Your password" />
          <button id="login-btn">Log In</button>
          <div class="footer-note">This portal is creator-only. It uses the existing Benchmrk creator user and profile data model.</div>
        </div>
      </section>

      <section id="dashboard-view" class="hidden">
        <div class="card">
          <div class="panel-title">
            <div>
              <h2 id="creator-name">Creator Dashboard</h2>
              <p id="creator-subtitle" class="muted"></p>
            </div>
            <span class="status" id="creator-kyc">KYC</span>
          </div>

          <div class="stats">
            <div class="meta-block">
              <div class="meta-label">Pending</div>
              <div class="value" id="pending-amount">₹0</div>
            </div>
            <div class="meta-block">
              <div class="meta-label">Withdrawable</div>
              <div class="value" id="withdrawable-amount">₹0</div>
            </div>
            <div class="meta-block">
              <div class="meta-label">Lifetime Earned</div>
              <div class="value" id="lifetime-earned">₹0</div>
            </div>
            <div class="meta-block">
              <div class="meta-label">Submissions</div>
              <div class="value" id="submission-count">0</div>
            </div>
            <div class="meta-block">
              <div class="meta-label">Tracked Views</div>
              <div class="value" id="tracked-views">0</div>
            </div>
          </div>
          <div class="tiny" id="dashboard-note"></div>
        </div>

        <div class="grid" style="margin-top: 16px;">
          <section class="card">
            <div class="panel-title">
              <div>
                <h3>Submit Video</h3>
                <p class="muted">Choose any live campaign and submit a video URL. Instagram tracking requires your Instagram professional account to be connected below.</p>
              </div>
            </div>
            <label>Campaign</label>
            <select id="submission-campaign"></select>
            <label>Platform</label>
            <select id="submission-platform">
              <option value="YOUTUBE">YouTube</option>
              <option value="INSTAGRAM">Instagram</option>
            </select>
            <label>Video URL</label>
            <input id="submission-url" placeholder="https://youtube.com/watch?v=..." />
            <button id="submit-video-btn">Submit Video</button>
            <div class="footer-note">The creator portal auto-creates an accepted application for the selected live campaign so you can test submission flow quickly.</div>
          </section>

          <section class="card">
            <div class="panel-title">
              <div>
                <h3>Instagram Connection</h3>
                <p class="muted">Connect your own Instagram professional account so Benchmrk can read metrics for your existing and newly posted reels/videos.</p>
              </div>
            </div>
            <div id="instagram-connection-status" class="footer-note">Instagram not connected.</div>
            <div class="toolbar" style="margin-top: 12px;">
              <button id="instagram-connect-btn">Connect Instagram Account</button>
              <button id="instagram-baseline-btn" class="secondary">Rebuild Instagram Baseline</button>
            </div>
            <div class="footer-note">After connection, submit an Instagram reel/post URL from that same account. Tracking snapshots will then run on the normal submission schedule.</div>
          </section>

          <section class="card">
            <div class="panel-title">
              <div>
                <h3>Live Campaigns</h3>
                <p class="muted">These are the campaigns currently available to creators.</p>
              </div>
            </div>
            <div id="campaign-list" class="list"></div>
          </section>
        </div>

        <section class="card" style="margin-top: 16px;">
          <div class="panel-title">
            <div>
              <h3>Your Submissions</h3>
              <p class="muted">Pending value is estimated from the latest snapshot and brand CPV, minus any already verified batches.</p>
            </div>
          </div>
          <div id="submission-list" class="list"></div>
        </section>

        <section class="card" style="margin-top: 16px;">
          <div class="panel-title">
            <div>
              <h3>Wallet / Account History</h3>
              <p class="muted">Only finalized money movements are shown here: when money becomes withdrawable, and later when money is actually withdrawn.</p>
            </div>
          </div>
          <div id="wallet-history-list" class="list"></div>
        </section>
      </section>

      <section class="card" style="margin-top: 16px;">
        <h3>Activity</h3>
        <div id="status" class="tiny"></div>
        <pre id="output" style="white-space: pre-wrap; word-break: break-word; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 14px; min-height: 160px;"></pre>
      </section>
    </div>

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
        statusEl.className = 'tiny ' + (kind === 'error' ? 'error' : kind === 'success' ? 'success' : '');
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
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
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
          campaignSelect.innerHTML = '<option value="">No live campaigns available</option>';
          return;
        }
        campaignSelect.innerHTML = campaigns.map((campaign) => {
          return '<option value="' + campaign.id + '">' + campaign.title + ' | ' + campaign.brandName + ' | Budget=' + formatCurrency(campaign.totalBudget) + ' | Left=' + formatCurrency(campaign.remainingBudget) + ' | $/1000=' + Number(campaign.dollarsPerThousandViews || 0).toFixed(2) + '</option>';
        }).join('');
      }

      function renderCampaigns(campaigns) {
        const container = document.getElementById('campaign-list');
        if (!Array.isArray(campaigns) || campaigns.length === 0) {
          container.innerHTML = '<div class="campaign-item"><div class="muted">No live campaigns found.</div></div>';
          renderCampaignOptions([]);
          return;
        }

        renderCampaignOptions(campaigns);
        container.innerHTML = campaigns.map((campaign) => {
          return [
            '<div class="campaign-item">',
            '<div class="panel-title"><strong>' + campaign.title + '</strong><span class="status">' + campaign.brandName + '</span></div>',
            '<p class="muted">' + (campaign.description || 'No description provided.') + '</p>',
            '<div class="campaign-meta">',
            '<div class="meta-block"><div class="meta-label">Guidelines</div><div class="meta-value">' + (campaign.guidelines || '—') + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Campaign Budget</div><div class="meta-value">' + formatCurrency(campaign.totalBudget) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Budget Remaining</div><div class="meta-value">' + formatCurrency(campaign.remainingBudget) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">$ / 1000 Views</div><div class="meta-value">' + Number(campaign.dollarsPerThousandViews || 0).toFixed(2) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Min Incremental Views</div><div class="meta-value">' + formatNumber(campaign.minimumPayoutViews) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Per Video Cap</div><div class="meta-value">' + formatCurrency(campaign.maxPayoutPerSubmission) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Sweep Eligible</div><div class="meta-value">' + (campaign.isSweepEligible ? 'Ready' : formatDate(campaign.sweepEligibleAt)) + '</div></div>',
            '</div>',
            '</div>',
          ].join('');
        }).join('');
      }

      function renderSubmissions(submissions) {
        const container = document.getElementById('submission-list');
        if (!Array.isArray(submissions) || submissions.length === 0) {
          container.innerHTML = '<div class="submission-item"><div class="muted">No submissions yet.</div></div>';
          return;
        }

        container.innerHTML = submissions.map((submission) => {
          return [
            '<div class="submission-item">',
            '<div class="panel-title"><strong>' + submission.campaignTitle + '</strong><span class="status">' + submission.status + '</span></div>',
            '<div class="tiny"><a href="' + submission.contentUrl + '" target="_blank" rel="noreferrer">' + submission.contentUrl + '</a></div>',
            '<div class="submission-meta">',
            '<div class="meta-block"><div class="meta-label">Platform</div><div class="meta-value">' + submission.platform + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Submitted</div><div class="meta-value">' + formatDate(submission.createdAt) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Latest Views</div><div class="meta-value">' + formatNumber(submission.latestViews) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Verified Views</div><div class="meta-value">' + formatNumber(submission.verifiedViews) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Pending</div><div class="meta-value">' + formatCurrency(submission.pendingAmount) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Withdrawable</div><div class="meta-value">' + formatCurrency(submission.withdrawableAmount) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Projected Value</div><div class="meta-value">' + formatCurrency(submission.projectedValue) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Campaign Budget</div><div class="meta-value">' + formatCurrency(submission.totalBudget) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Budget Remaining</div><div class="meta-value">' + formatCurrency(submission.remainingBudget) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Last Snapshot</div><div class="meta-value">' + formatDate(submission.latestSnapshotAt) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Min Incremental Views</div><div class="meta-value">' + formatNumber(submission.minimumIncrementalViewsPerSweep) + '</div></div>',
            '</div>',
            '</div>',
          ].join('');
        }).join('');
      }

      function renderWalletHistory(entries) {
        const container = document.getElementById('wallet-history-list');
        if (!Array.isArray(entries) || entries.length === 0) {
          container.innerHTML = '<div class="history-item"><div class="muted">No finalized wallet history yet.</div></div>';
          return;
        }

        container.innerHTML = entries.map((entry) => {
          const title = entry.entryType === 'WITHDRAWAL'
            ? 'Withdrawal completed'
            : 'Money became withdrawable';
          const when = entry.releasedAt || entry.createdAt;
          const submissionText = entry.submission
            ? (entry.submission.campaignTitle || 'Campaign') + ' • ' + entry.submission.platform
            : 'Wallet-level entry';

          return [
            '<div class="history-item">',
            '<div class="panel-title"><strong>' + title + '</strong><span class="status">' + entry.status + '</span></div>',
            '<div class="history-meta">',
            '<div class="meta-block"><div class="meta-label">Amount</div><div class="meta-value">' + formatCurrency(entry.amount) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Type</div><div class="meta-value">' + entry.entryType + '</div></div>',
            '<div class="meta-block"><div class="meta-label">When</div><div class="meta-value">' + formatDate(when) + '</div></div>',
            '<div class="meta-block"><div class="meta-label">Source</div><div class="meta-value">' + submissionText + '</div></div>',
            '</div>',
            (entry.submission?.contentUrl ? '<div class="tiny" style="margin-top: 10px;"><a href="' + entry.submission.contentUrl + '" target="_blank" rel="noreferrer">' + entry.submission.contentUrl + '</a></div>' : ''),
            (entry.notes ? '<div class="footer-note">' + entry.notes + '</div>' : ''),
            '</div>'
          ].join('');
        }).join('');
      }

      function renderDashboard(data) {
        dashboardData = data;
        document.getElementById('creator-name').textContent = data.creator.displayName + ' Dashboard';
        document.getElementById('creator-subtitle').textContent = data.creator.email + (data.creator.bio ? ' • ' + data.creator.bio : '');
        document.getElementById('creator-kyc').textContent = 'KYC: ' + data.creator.kycStatus;
        document.getElementById('pending-amount').textContent = formatCurrency(data.summary.pendingAmount);
        document.getElementById('withdrawable-amount').textContent = formatCurrency(data.summary.withdrawableAmount);
        document.getElementById('lifetime-earned').textContent = formatCurrency(data.summary.lifetimeEarned);
        document.getElementById('submission-count').textContent = formatNumber(data.summary.totalSubmissions);
        document.getElementById('tracked-views').textContent = formatNumber(data.summary.totalLatestViews);
        document.getElementById('dashboard-note').textContent = 'Projected value: ' + formatCurrency(data.summary.totalProjectedValue) + ' • Reputation score: ' + Number(data.creator.reputationScore || 0).toFixed(2);
        const instagram = data.integrations?.instagram;
        document.getElementById('instagram-connection-status').textContent = instagram?.connected
          ? 'Connected: @' + (instagram.username || 'instagram-account') + ' • Followers: ' + formatNumber(instagram.followerCount) + ' • Type: ' + (instagram.accountType || 'PROFESSIONAL')
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
