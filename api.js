/*
 * API layer. Live mode talks to YOUR backend (never directly to YouTube with a key).
 * Demo mode returns clearly labelled samples from data.js.
 *
 * Backend contract: GET {API_BASE_URL}/api/discover?category=<id>&q=<text>&limit=5|10
 *   -> { cached, generatedAt, refreshAfter, items: [{ videoId, title, channelId, channelTitle,
 *        publishedAt, durationSeconds, stats: { views, likes, comments } }] }
 * URLs and thumbnails are rebuilt here from validated IDs, so the server cannot inject links.
 */
(function () {
  'use strict';
  const YTD = (window.YTD = window.YTD || {});
  const cfg = window.APP_CONFIG || {};
  const base = String(cfg.API_BASE_URL || '').trim().replace(/\/+$/, '');

  const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
  const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;

  class ApiError extends Error {
    constructor(code, message) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
    }
  }

  const isLive = () => base.length > 0;
  const count = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);

  function normalizeItem(raw) {
    if (!raw || !VIDEO_ID.test(raw.videoId)) return null;
    const stats = raw.stats || {};
    return {
      sample: false,
      id: raw.videoId,
      title: String(raw.title || 'Untitled video').slice(0, 200),
      channelTitle: String(raw.channelTitle || 'Unknown channel').slice(0, 100),
      channelUrl: CHANNEL_ID.test(raw.channelId) ? 'https://www.youtube.com/channel/' + raw.channelId : null,
      videoUrl: 'https://www.youtube.com/watch?v=' + raw.videoId,
      thumbUrl: 'https://i.ytimg.com/vi/' + raw.videoId + '/hqdefault.jpg',
      publishedAt: raw.publishedAt || null,
      durationSeconds: count(raw.durationSeconds),
      stats: { views: count(stats.views), likes: count(stats.likes), comments: count(stats.comments) }
    };
  }

  async function discoverLive({ category, q, limit, signal }) {
    const url = new URL(base + '/api/discover');
    url.searchParams.set('category', category);
    if (q) url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));

    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, cfg.REQUEST_TIMEOUT_MS || 15000);
    const onAbort = () => ctl.abort();
    if (signal) {
      if (signal.aborted) ctl.abort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }

    let body = null;
    try {
      const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
      body = await res.json().catch(() => null);
      if (!res.ok) {
        const code = body && body.error;
        const known = ['quota_exceeded', 'not_configured'].includes(code) ? code : 'server';
        throw new ApiError(known, 'Backend responded with HTTP ' + res.status);
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (timedOut) throw new ApiError('timeout', 'The request timed out.');
      if (signal && signal.aborted) throw err;
      throw new ApiError('network', 'Could not reach the backend.');
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }

    if (!body || !Array.isArray(body.items)) throw new ApiError('bad_response', 'Unexpected response format.');

    const items = body.items.map(normalizeItem).filter(Boolean).slice(0, limit)
      .map((it, i) => Object.assign(it, { rank: i + 1 }));
    return {
      mode: 'live', category, query: q, limit, items,
      cached: Boolean(body.cached),
      generatedAt: body.generatedAt || null,
      refreshAfter: body.refreshAfter || null
    };
  }

  function discoverDemo({ category, q, limit }) {
    return Promise.resolve({
      mode: 'demo', category, query: q, limit,
      items: YTD.buildDemo(category, q, limit),
      cached: false, generatedAt: null, refreshAfter: null
    });
  }

  YTD.api = {
    isLive,
    ApiError,
    discoverDemo,
    discover: (req) => (isLive() ? discoverLive(req) : discoverDemo(req))
  };
})();
