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
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Phase 4A Admin Review Tester</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b1020;
        --panel: #121a31;
        --panel-2: #0f1730;
        --text: #e7ecff;
        --muted: #9aa7d3;
        --accent: #7c9cff;
        --accent-2: #57d3bc;
        --danger: #ff7b8b;
        --border: rgba(154, 167, 211, 0.18);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: linear-gradient(180deg, #0a0f1c 0%, #111935 100%);
        color: var(--text);
      }
      .wrap { max-width: 1480px; margin: 0 auto; padding: 24px; }
      h1, h2, h3, p { margin-top: 0; }
      .hero, .card {
        background: rgba(18, 26, 49, 0.92);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.25);
      }
      .hero { padding: 24px; margin-bottom: 20px; }
      .hero p, .muted { color: var(--muted); }
      .status { margin-top: 12px; color: var(--accent-2); font-weight: 600; }
      .grid { display: grid; grid-template-columns: 340px minmax(0, 1fr) 420px; gap: 16px; align-items: start; }
      .card { padding: 16px; }
      .controls { display: grid; gap: 10px; }
      label {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--muted);
        margin-bottom: 6px;
      }
      input, select, textarea, button {
        width: 100%;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--panel-2);
        color: var(--text);
        padding: 12px 14px;
        font: inherit;
      }
      textarea { min-height: 110px; resize: vertical; }
      button { cursor: pointer; background: linear-gradient(135deg, var(--accent), #5e7dff); font-weight: 700; border: none; }
      button.secondary { background: rgba(124, 156, 255, 0.16); border: 1px solid rgba(124, 156, 255, 0.25); }
      button.ghost { background: rgba(255, 255, 255, 0.04); border: 1px solid var(--border); }
      button.danger { background: linear-gradient(135deg, #ff7b8b, #f14d63); }
      button.success { background: linear-gradient(135deg, #57d3bc, #2db495); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      .queue { display: grid; gap: 12px; max-height: 70vh; overflow: auto; padding-right: 4px; }
      .item {
        border: 1px solid var(--border);
        border-radius: 16px;
        padding: 14px;
        background: rgba(15, 23, 48, 0.9);
      }
      .item.active { border-color: rgba(124, 156, 255, 0.65); box-shadow: 0 0 0 1px rgba(124, 156, 255, 0.3) inset; }
      .item h3 { margin-bottom: 8px; font-size: 16px; }
      .meta, .list { display: grid; gap: 6px; color: var(--muted); font-size: 13px; }
      .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
      .pill {
        display: inline-flex;
        align-items: center;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 5px 10px;
        font-size: 12px;
        color: var(--text);
        background: rgba(255,255,255,0.04);
      }
      .pill.pending { color: #ffe08a; }
      .pill.verified { color: #78e0b9; }
      .pill.rejected { color: #ff9aa5; }
      .pill.info { color: #8bd1ff; }
      .section { margin-bottom: 18px; }
      .section:last-child { margin-bottom: 0; }
      .section h3 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 10px; }
      .detail-grid { display: grid; gap: 8px; font-size: 14px; }
      .detail-grid strong { color: var(--text); }
      .actions { display: grid; gap: 10px; }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        overflow: auto;
        background: rgba(8, 14, 29, 0.9);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 14px;
        color: #d9e1ff;
        max-height: 42vh;
      }
      a { color: #9fc2ff; }
      @media (max-width: 1200px) {
        .grid { grid-template-columns: 1fr; }
        .queue { max-height: none; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <section class="hero">
        <h1>Phase 4A Admin Review Tester</h1>
        <p>Use this page to run the 15-day campaign-relative sweep, inspect reviewable videos, and verify, reject, or request more info without touching HTTP clients.</p>
        <div class="status" id="boot-status">Booting hidden admin session...</div>
      </section>

      <div class="grid">
        <section class="card controls">
          <div>
            <label for="campaign-id">Campaign ID Filter</label>
            <input id="campaign-id" placeholder="Leave empty to include all live campaigns" />
          </div>
          <div>
            <label for="status-filter">Queue Status Filter</label>
            <select id="status-filter">
              <option value="">All statuses</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="MORE_INFO_REQUESTED">More info requested</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
          <button id="run-sweep-btn">Run Sweep</button>
          <button id="refresh-queue-btn" class="secondary">Refresh Queue</button>
          <button id="clear-selection-btn" class="ghost">Clear Selected Batch</button>
          <div class="section">
            <h3>Action Note</h3>
            <textarea id="action-note" placeholder="Add optional checker notes before you verify, reject, or request more info."></textarea>
          </div>
          <div class="actions">
            <button id="verify-btn" class="success" disabled>Verify Batch</button>
            <button id="request-info-btn" class="secondary" disabled>Request More Info</button>
            <button id="reject-btn" class="danger" disabled>Reject Batch</button>
          </div>
        </section>

        <section class="card">
          <div class="section">
            <h2>Review Queue</h2>
            <div class="muted" id="queue-meta">No queue loaded yet.</div>
          </div>
          <div id="queue" class="queue"></div>
        </section>

        <section class="card">
          <div class="section">
            <h2>Selected Batch</h2>
            <div class="muted" id="selection-meta">Pick a queue item to inspect the full review payload.</div>
          </div>
          <div id="detail"></div>
          <div class="section">
            <h3>Raw Response</h3>
            <pre id="output">No response yet.</pre>
          </div>
        </section>
      </div>
    </div>

    <script>
      const bootStatus = document.getElementById('boot-status');
      const campaignIdInput = document.getElementById('campaign-id');
      const statusFilter = document.getElementById('status-filter');
      const queueMeta = document.getElementById('queue-meta');
      const queueEl = document.getElementById('queue');
      const detailEl = document.getElementById('detail');
      const selectionMeta = document.getElementById('selection-meta');
      const output = document.getElementById('output');
      const actionNote = document.getElementById('action-note');
      const verifyBtn = document.getElementById('verify-btn');
      const rejectBtn = document.getElementById('reject-btn');
      const requestInfoBtn = document.getElementById('request-info-btn');
      let authToken = '';
      let queueItems = [];
      let selectedBatchId = '';

      function formatDate(value) {
        if (!value) return '—';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
      }

      function formatNumber(value) {
        return typeof value === 'number' ? value.toLocaleString() : Number(value || 0).toLocaleString();
      }

      function escapeHtml(value) {
        return String(value ?? '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function statusClass(value) {
        if (value === 'VERIFIED') return 'verified';
        if (value === 'REJECTED') return 'rejected';
        if (value === 'MORE_INFO_REQUESTED') return 'info';
        return 'pending';
      }

      function setSelectedBatch(batchId) {
        selectedBatchId = batchId || '';
        const disabled = !selectedBatchId;
        verifyBtn.disabled = disabled;
        rejectBtn.disabled = disabled;
        requestInfoBtn.disabled = disabled;
        renderQueue(queueItems);
      }

      function renderRaw(data) {
        output.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }

      function summarizeReasons(list) {
        return Array.isArray(list) && list.length
          ? list.map((item) => '<li>' + escapeHtml(item) + '</li>').join('')
          : '<li>—</li>';
      }

      function renderDetail(data) {
        if (!data || !data.batch) {
          detailEl.innerHTML = '<div class="muted">No batch selected.</div>';
          selectionMeta.textContent = 'Pick a queue item to inspect the full review payload.';
          return;
        }

        const batch = data.batch;
        const tracking = data.tracking || {};
        const submission = tracking.submission || {};
        const reviewSignals = tracking.reviewSignals || {};
        const snapshots = tracking.snapshots || [];
        const latestSnapshot = snapshots[snapshots.length - 1] || {};

        selectionMeta.textContent = 'Batch ' + batch.id + ' • ' + (submission.creator?.displayName || batch.submission?.creator?.displayName || 'Unknown creator');
        detailEl.innerHTML = [
          '<div class="section"><div class="pill-row">',
          '<span class="pill ' + statusClass(batch.status) + '">' + escapeHtml(batch.status) + '</span>',
          '<span class="pill">Cycle ' + escapeHtml(batch.cycleNumber) + '</span>',
          '<span class="pill">Signal ' + escapeHtml(reviewSignals.signalLevel || '—') + '</span>',
          '</div></div>',
          '<div class="section detail-grid">',
          '<div><strong>Campaign:</strong> ' + escapeHtml(submission.campaign?.title || batch.campaign?.title || '—') + '</div>',
          '<div><strong>Creator:</strong> ' + escapeHtml(submission.creator?.displayName || batch.submission?.creator?.displayName || '—') + '</div>',
          '<div><strong>Video:</strong> <a href="' + escapeHtml(submission.contentUrl || batch.submission?.contentUrl || '#') + '" target="_blank" rel="noreferrer">' + escapeHtml(submission.contentUrl || batch.submission?.contentUrl || '—') + '</a></div>',
          '<div><strong>Platform:</strong> ' + escapeHtml(submission.platform || batch.submission?.platform || '—') + '</div>',
          '<div><strong>Window Opened:</strong> ' + escapeHtml(formatDate(batch.windowOpenedAt)) + '</div>',
          '<div><strong>Review Started:</strong> ' + escapeHtml(formatDate(batch.reviewStartedAt)) + '</div>',
          '<div><strong>Locked Views:</strong> ' + escapeHtml(formatNumber(batch.lockedFromViews)) + ' → ' + escapeHtml(formatNumber(batch.lockedToViews)) + '</div>',
          '<div><strong>Incremental Views:</strong> ' + escapeHtml(formatNumber(batch.incrementalViews)) + '</div>',
          '<div><strong>Gross Amount:</strong> ' + escapeHtml(formatNumber(batch.grossAmount)) + '</div>',
          '<div><strong>Latest Snapshot Views:</strong> ' + escapeHtml(formatNumber(latestSnapshot.viewCount)) + '</div>',
          '<div><strong>Estimated Current Value:</strong> ' + escapeHtml(formatNumber(submission.estimatedCurrentValue)) + '</div>',
          '<div><strong>Risk Score:</strong> ' + escapeHtml(formatNumber(reviewSignals.riskScore)) + '</div>',
          '<div><strong>Confidence Score:</strong> ' + escapeHtml(formatNumber(reviewSignals.confidenceScore)) + '</div>',
          '<div><strong>Resolved At:</strong> ' + escapeHtml(formatDate(batch.resolvedAt)) + '</div>',
          '<div><strong>Admin Notes:</strong> ' + escapeHtml(batch.adminNotes || '—') + '</div>',
          '<div><strong>More Info Request:</strong> ' + escapeHtml(batch.moreInfoRequest || '—') + '</div>',
          '</div>',
          '<div class="section"><h3>Review Reasons</h3><ul class="list">' + summarizeReasons(reviewSignals.reasons) + '</ul></div>',
          '<div class="section"><h3>Positive Signals</h3><ul class="list">' + summarizeReasons(reviewSignals.positiveSignals) + '</ul></div>',
          '<div class="section"><h3>Concerns</h3><ul class="list">' + summarizeReasons(reviewSignals.concerns) + '</ul></div>',
        ].join('');
      }

      function renderQueue(items) {
        queueItems = Array.isArray(items) ? items : [];
        queueMeta.textContent = queueItems.length + ' review batch' + (queueItems.length === 1 ? '' : 'es') + ' loaded.';

        if (!queueItems.length) {
          queueEl.innerHTML = '<div class="muted">No review batches found. Run Sweep after your dev submission has enough views and snapshots.</div>';
          if (!selectedBatchId) {
            renderDetail(null);
          }
          return;
        }

        queueEl.innerHTML = queueItems.map((item) => {
          const batch = item.batch || {};
          const tracking = item.tracking || {};
          const submission = tracking.submission || {};
          const reviewSignals = tracking.reviewSignals || {};
          const activeClass = batch.id === selectedBatchId ? 'active' : '';

          return [
            '<div class="item ' + activeClass + '" data-batch-id="' + escapeHtml(batch.id || '') + '">',
            '<h3>' + escapeHtml(submission.campaign?.title || batch.campaign?.title || 'Untitled campaign') + '</h3>',
            '<div class="meta">',
            '<div><strong>Creator:</strong> ' + escapeHtml(submission.creator?.displayName || batch.submission?.creator?.displayName || '—') + '</div>',
            '<div><strong>Status:</strong> ' + escapeHtml(batch.status || '—') + '</div>',
            '<div><strong>Signal:</strong> ' + escapeHtml(reviewSignals.signalLevel || '—') + '</div>',
            '<div><strong>Views:</strong> ' + escapeHtml(formatNumber(batch.lockedFromViews)) + ' → ' + escapeHtml(formatNumber(batch.lockedToViews)) + '</div>',
            '<div><strong>Incremental:</strong> ' + escapeHtml(formatNumber(batch.incrementalViews)) + '</div>',
            '<div><strong>Gross:</strong> ' + escapeHtml(formatNumber(batch.grossAmount)) + '</div>',
            '</div>',
            '<div class="pill-row">',
            '<span class="pill ' + statusClass(batch.status) + '">' + escapeHtml(batch.status || '—') + '</span>',
            '<span class="pill">' + escapeHtml(submission.platform || batch.submission?.platform || '—') + '</span>',
            '</div>',
            '<button class="ghost open-batch-btn" data-batch-id="' + escapeHtml(batch.id || '') + '">Open Batch</button>',
            '</div>',
          ].join('');
        }).join('');

        queueEl.querySelectorAll('.open-batch-btn').forEach((button) => {
          button.addEventListener('click', async () => {
            const batchId = button.getAttribute('data-batch-id');
            if (!batchId) return;
            setSelectedBatch(batchId);
            await loadBatch(batchId);
          });
        });
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
        bootStatus.textContent = 'Ready: ' + data.user.email;
      }

      async function loadQueue() {
        const params = new URLSearchParams();
        if (campaignIdInput.value.trim()) params.set('campaignId', campaignIdInput.value.trim());
        if (statusFilter.value) params.set('status', statusFilter.value);
        const query = params.toString();
        const data = await api('/admin/review-batches' + (query ? '?' + query : ''));
        renderQueue(data);
      }

      async function loadBatch(batchId) {
        const data = await api('/admin/review-batches/' + encodeURIComponent(batchId));
        renderDetail(data);
      }

      async function runSweep() {
        const campaignId = campaignIdInput.value.trim();
        await api('/admin/review-batches/sweep', {
          method: 'POST',
          body: JSON.stringify(campaignId ? { campaignId } : {}),
        });
        await loadQueue();
      }

      async function runAction(action) {
        if (!selectedBatchId) return;
        const note = actionNote.value.trim();
        await api('/admin/review-batches/' + encodeURIComponent(selectedBatchId), {
          method: 'PATCH',
          body: JSON.stringify(note ? { action, note } : { action }),
        });
        await loadQueue();
        await loadBatch(selectedBatchId);
      }

      function handleError(error) {
        bootStatus.textContent = error && error.message ? error.message : 'Request failed';
      }

      document.getElementById('run-sweep-btn').addEventListener('click', () => runSweep().catch(handleError));
      document.getElementById('refresh-queue-btn').addEventListener('click', () => loadQueue().catch(handleError));
      document.getElementById('clear-selection-btn').addEventListener('click', () => {
        setSelectedBatch('');
        renderDetail(null);
      });
      verifyBtn.addEventListener('click', () => runAction('VERIFY').catch(handleError));
      rejectBtn.addEventListener('click', () => runAction('REJECT').catch(handleError));
      requestInfoBtn.addEventListener('click', () => runAction('REQUEST_MORE_INFO').catch(handleError));

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
