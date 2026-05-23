import type { FastifyInstance } from 'fastify';

const page = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Phase 2 Baseline Tester</title>
    <style>
      body { font-family: Inter, Arial, sans-serif; margin: 0; background: #0f172a; color: #e2e8f0; }
      .wrap { max-width: 1100px; margin: 0 auto; padding: 32px 20px 48px; }
      h1 { margin: 0 0 8px; font-size: 32px; }
      p { color: #94a3b8; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 24px; }
      .card { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 18px; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
      .card h2 { margin-top: 0; font-size: 18px; }
      label { display: block; margin: 12px 0 6px; font-size: 14px; color: #cbd5e1; }
      input, select, textarea, button { width: 100%; box-sizing: border-box; border-radius: 10px; border: 1px solid #334155; background: #020617; color: #e2e8f0; padding: 10px 12px; font: inherit; }
      textarea { min-height: 140px; resize: vertical; }
      button { background: #2563eb; border: none; cursor: pointer; font-weight: 600; margin-top: 12px; }
      button:hover { background: #1d4ed8; }
      .wide { margin-top: 20px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #020617; border: 1px solid #334155; border-radius: 12px; padding: 14px; min-height: 180px; }
      .token { font-size: 12px; color: #93c5fd; overflow-wrap: anywhere; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1>Phase 2 Baseline Tester</h1>
      <p>Use this page to test signup, login, creator profile creation, baseline rebuild, and baseline fetch against the Fastify server.</p>

      <div class="grid">
        <section class="card">
          <h2>1. Sign Up</h2>
          <label>Email</label>
          <input id="signup-email" value="creator_phase2@example.com" />
          <label>Password</label>
          <input id="signup-password" value="creatorpass123" type="password" />
          <label>Role</label>
          <select id="signup-role">
            <option value="CREATOR">CREATOR</option>
            <option value="BRAND">BRAND</option>
          </select>
          <button id="signup-btn">Sign Up</button>
        </section>

        <section class="card">
          <h2>2. Login</h2>
          <label>Email</label>
          <input id="login-email" value="creator_phase2@example.com" />
          <label>Password</label>
          <input id="login-password" value="creatorpass123" type="password" />
          <button id="login-btn">Login</button>
          <label>JWT Token</label>
          <textarea id="token"></textarea>
        </section>

        <section class="card">
          <h2>3. Create Creator Profile</h2>
          <label>Display Name</label>
          <input id="display-name" value="Phase 2 Creator" />
          <label>Bio</label>
          <input id="bio" value="Testing creator baseline rebuild flow" />
          <button id="profile-btn">Create Profile</button>
        </section>

        <section class="card">
          <h2>4. Rebuild Baseline</h2>
          <div class="row">
            <div>
              <label>Platform</label>
              <select id="platform">
                <option value="INSTAGRAM">INSTAGRAM</option>
                <option value="YOUTUBE">YOUTUBE</option>
              </select>
            </div>
            <div>
              <label>Account Age Days</label>
              <input id="account-age-days" type="number" value="420" />
            </div>
          </div>
          <div class="row">
            <div>
              <label>Follower Count</label>
              <input id="follower-count" type="number" value="18000" />
            </div>
            <div>
              <label>Audience India %</label>
              <input id="audience-india-pct" type="number" value="72" />
            </div>
          </div>
          <label>Posts JSON</label>
          <textarea id="posts-json">[
  {"views": 21000, "likes": 820, "comments": 90},
  {"views": 18500, "likes": 760, "comments": 82},
  {"views": 24000, "likes": 950, "comments": 105},
  {"views": 19800, "likes": 790, "comments": 88},
  {"views": 22300, "likes": 870, "comments": 96}
]</textarea>
          <button id="rebuild-btn">Rebuild Baseline</button>
          <button id="fetch-btn">Fetch Baseline</button>
        </section>

        <section class="card">
          <h2>5. Live YouTube Baseline</h2>
          <label>Channel URL / @handle / Channel ID</label>
          <input id="youtube-channel-input" value="@YouTubeCreators" />
          <label>Videos to Sample</label>
          <input id="youtube-max-results" type="number" min="1" max="30" value="10" />
          <button id="youtube-live-btn">Fetch Live YouTube Baseline</button>
        </section>

        <section class="card">
          <h2>6. Connect YouTube</h2>
          <p>Verify channel ownership through Google OAuth before we add persistent linked-account storage.</p>
          <button id="youtube-connect-btn">Connect YouTube Account</button>
          <button id="youtube-connected-baseline-btn">Rebuild Baseline From Connected YouTube</button>
        </section>
      </div>

      <section class="card wide">
        <h2>Response</h2>
        <div class="token" id="status"></div>
        <pre id="output"></pre>
      </section>
    </div>

    <script>
      const output = document.getElementById('output');
      const status = document.getElementById('status');
      const tokenInput = document.getElementById('token');
      const storedToken = localStorage.getItem('phase2Token');
      if (storedToken) tokenInput.value = storedToken;

      window.addEventListener('message', (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type !== 'youtube-connect-result') return;
        render(event.data.payload, 'YOUTUBE OAUTH RESULT');
      });

      function render(result, meta) {
        status.textContent = meta;
        output.textContent = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      }

      async function api(path, options = {}) {
        const token = tokenInput.value.trim();
        const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
        if (token) headers.Authorization = 'Bearer ' + token;

        const response = await fetch(path, { ...options, headers });
        const text = await response.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = text;
        }
        render(data, (options.method || 'GET') + ' ' + path + ' -> ' + response.status);
        if (!response.ok) throw new Error('Request failed');
        return data;
      }

      document.getElementById('signup-btn').onclick = async () => {
        const data = await api('/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('signup-email').value,
            password: document.getElementById('signup-password').value,
            role: document.getElementById('signup-role').value,
          }),
        });
        if (data.token) {
          tokenInput.value = data.token;
          localStorage.setItem('phase2Token', data.token);
        }
      };

      document.getElementById('login-btn').onclick = async () => {
        const data = await api('/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value,
          }),
        });
        if (data.token) {
          tokenInput.value = data.token;
          localStorage.setItem('phase2Token', data.token);
        }
      };

      document.getElementById('profile-btn').onclick = async () => {
        await api('/creators/profile', {
          method: 'POST',
          body: JSON.stringify({
            displayName: document.getElementById('display-name').value,
            bio: document.getElementById('bio').value,
          }),
        });
      };

      document.getElementById('rebuild-btn').onclick = async () => {
        const posts = JSON.parse(document.getElementById('posts-json').value);
        await api('/creators/baseline/rebuild', {
          method: 'POST',
          body: JSON.stringify({
            platform: document.getElementById('platform').value,
            accountAgeDays: Number(document.getElementById('account-age-days').value),
            followerCount: Number(document.getElementById('follower-count').value),
            audienceIndiaPct: Number(document.getElementById('audience-india-pct').value),
            posts,
          }),
        });
      };

      document.getElementById('fetch-btn').onclick = async () => {
        const platform = document.getElementById('platform').value;
        await api('/creators/baseline?platform=' + platform);
      };

      document.getElementById('youtube-live-btn').onclick = async () => {
        await api('/creators/baseline/rebuild/youtube-live', {
          method: 'POST',
          body: JSON.stringify({
            channelInput: document.getElementById('youtube-channel-input').value,
            maxResults: Number(document.getElementById('youtube-max-results').value),
          }),
        });
      };

      document.getElementById('youtube-connect-btn').onclick = async () => {
        const data = await api('/auth/youtube/start');
        const popup = window.open(data.authUrl, 'youtube-oauth', 'width=520,height=720');
        if (!popup) {
          render({ error: 'Popup blocked. Allow popups for localhost and try again.' }, 'YOUTUBE OAUTH');
        }
      };

      document.getElementById('youtube-connected-baseline-btn').onclick = async () => {
        await api('/creators/baseline/rebuild/youtube-connected', {
          method: 'POST',
          body: JSON.stringify({
            maxResults: Number(document.getElementById('youtube-max-results').value),
          }),
        });
      };
    </script>
  </body>
</html>`;

export async function baselineDevRoutes(app: FastifyInstance) {
  app.get('/dev/phase2', async (_request, reply) => {
    return reply.type('text/html').send(page);
  });
}
