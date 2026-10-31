# WatchWise India — YouTube Video Discovery

A single-page, mobile-first website that helps people in India discover the best YouTube videos by category and description, with a Top 5 / Top 10 choice.

- **Frontend:** plain HTML/CSS/JS (no build step) — deploys to GitHub Pages.
- **Backend:** one small Cloudflare Worker (`backend/worker.js`, free tier) that holds the YouTube API key, ranks results and caches them for 20 days.
- **Two modes:** *Demo* (works immediately, clearly labelled samples) and *Live* (real YouTube data once the backend is connected).

## Project structure

```
index.html            Single page (all sections)
css/styles.css        Dark theme, responsive layout, animations
js/config.js          Public config — backend URL goes here (NO secrets)
js/data.js            Categories, ranking criteria, status list, demo sample builder
js/api.js             Live API client + demo fallback, response validation
js/app.js             UI logic (incl. voice input)
js/pwa.js             Service worker registration + "Install app" button
sw.js                 Service worker (offline app shell)
manifest.webmanifest  PWA manifest
icons/                App icons (192, 512, maskable, Apple touch)
backend/worker.js     Secure YouTube proxy: search, rank, 20-day cache, optional cron
backend/wrangler.toml Backend settings (allowed origins, optional KV + cron)
backend/test/         Backend tests (mocked YouTube API)
```

## 1. Run it now (Demo mode)

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8000     # then visit http://localhost:8000
```

Demo mode shows **sample ideas**, each opening a real YouTube *search* for that idea. They are not real videos, have no statistics, and are labelled "Demo sample" on screen.

## 2. Go live (real YouTube data)

### a) Get a YouTube Data API key
1. Google Cloud Console → create a project → **APIs & Services → Library → YouTube Data API v3 → Enable**.
2. **Credentials → Create credentials → API key**. Under *API restrictions*, restrict it to **YouTube Data API v3**.

### b) Deploy the backend
```bash
cd backend
npx wrangler login
# Edit wrangler.toml: set ALLOWED_ORIGINS to your GitHub Pages origin
npx wrangler secret put YOUTUBE_API_KEY     # paste the key when prompted
npx wrangler deploy                          # prints https://watchwise-api.<you>.workers.dev
```
Check it: open `<worker-url>/api/health` — it should show `"keyConfigured": true`.

### c) Connect the frontend
Put the Worker URL in `js/config.js`:
```js
API_BASE_URL: 'https://watchwise-api.<you>.workers.dev',
```
The mode badge in the hero switches from "Demo mode" to "Live mode".

### Where API configuration belongs

| What | Where | Public? |
|---|---|---|
| YouTube API key | Worker **secret** `YOUTUBE_API_KEY` (`wrangler secret put`), or `backend/.dev.vars` locally | **Never** public |
| Allowed website origins | `backend/wrangler.toml` → `ALLOWED_ORIGINS` | Public, not secret |
| Backend URL | `js/config.js` → `API_BASE_URL` | Public, not secret |

The key is never in `index.html` or any file under `js/`. Do not commit `.dev.vars`.

### Local backend development
```bash
cd backend && cp .dev.vars.example .dev.vars   # add your key
npx wrangler dev                               # http://127.0.0.1:8787
```
Set `ALLOWED_ORIGINS = ""` temporarily (allows any origin) and `API_BASE_URL: 'http://127.0.0.1:8787'`. Revert both before deploying.

## How ranking works

For each request the backend runs a YouTube search with `regionCode=IN` (50 candidates), fetches statistics for them, and scores each video:

| Criterion | Weight | Notes |
|---|---|---|
| Relevance | 45% | Position in YouTube's own relevance-ordered search |
| Popularity | 30% | Log-scaled view count |
| Engagement | 15% | Likes ÷ views (ignored if the channel hides likes) |
| Freshness | 10% | Gentle decay over ~2 years |

Shorts/videos under 90 s and live streams are skipped; at most 2 videos per channel appear. Top 5 is always the first five of Top 10. This is an estimate of "best" from available data and the chosen criteria, not an official YouTube ranking. Missing statistics are shown as unavailable — never estimated. To change weights, edit `WEIGHTS` in `backend/worker.js` and `YTD.criteria` in `js/data.js`.

## Caching and the 20-day refresh

- Every ranking is cached for **20 days** (`CACHE_TTL_SECONDS`). By default this uses the Workers Cache API; with a KV namespace bound as `RANKINGS` it is durable.
- **Scheduler (optional):** create a KV namespace, uncomment the `kv_namespaces` and `triggers` blocks in `wrangler.toml`, redeploy. The cron (`0 3 1,21 * *`) rebuilds the default ranking of all 12 categories on the 1st and 21st of each month (cron cannot express "exactly every 20 days"; this is the closest fit). Rankings for custom descriptions are built on first request and then cached for 20 days.

**Quota:** a search costs 100 units and the default quota is 10,000/day, so roughly 100 uncached searches per day. Caching is what makes this workable; request a quota increase from Google if traffic grows. When quota runs out the site shows a clear message.

## Deploy the frontend to GitHub Pages

1. Create a GitHub repository and push this folder (the `backend/` folder can stay in it).
2. Repo → **Settings → Pages** → *Build and deployment*: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Wait a minute; your site is at `https://<username>.github.io/<repo>/`.
4. Set `ALLOWED_ORIGINS` in `backend/wrangler.toml` to `https://<username>.github.io` (origin only, no path) and redeploy the Worker.

## Voice input

A mic button sits inside the description box. Tap it, speak, and the text appears in the box; the "हि / EN" chip switches between Hindi (`hi-IN`) and English-India (`en-IN`). It uses the browser's built-in Web Speech API, so it needs no key and no backend, but it only works in browsers that support it (Chrome on Android/desktop, Edge, Safari recent versions). Elsewhere the button hides itself. In Chrome the audio is processed by Google's speech service, which the page says next to the box. Voice needs HTTPS or localhost (GitHub Pages is fine).

## Install as an app (PWA)

- On Android Chrome, an **Install app** button appears in the hero (or use the browser menu → *Install app* / *Add to Home screen*). On iPhone: Safari → Share → *Add to Home Screen*.
- The service worker (`sw.js`) caches the app shell (HTML, CSS, JS, icons) so the app opens offline. Live video results always need internet: API responses, YouTube thumbnails and fonts are never cached by the service worker.
- Everything uses relative paths, so it works under a GitHub Pages sub-path such as `/<repo>/`.
- **When you change any file, bump `VERSION` in `sw.js`** (e.g. `v1` → `v2`) so installed copies pick up the update.

## Tests

```bash
node backend/test/worker.test.mjs     # Node 18+; mocks the YouTube API, no key needed
```

## Still needs a backend or API configuration

- Live results (real thumbnails, titles, channels, statistics) — deploy the Worker and set `API_BASE_URL`.
- Score-based ranking and 20-day cache — run in the Worker.
- Scheduled 20-day refresh — needs KV + cron enabled.
- Rate limiting / abuse protection — configure on your host (e.g. Cloudflare rate-limiting rules).
- Not built: AI (Gemini) analysis of videos, language filters (Hindi, Tamil, …), user accounts, saved lists, push notifications.

## Notes

- Using YouTube API Services means following the [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service); the footer already links the YouTube ToS and Google Privacy Policy. Review the terms for your use case before launching publicly.
- Video links go to `youtube.com/watch?v=…`, channel links to `youtube.com/channel/…`. The frontend rebuilds these from validated IDs rather than trusting URLs from the server.
