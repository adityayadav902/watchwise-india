/* UI controller: renders categories, handles the form, shows results / loading / errors. */
(function () {
  'use strict';

  const YTD = window.YTD;
  const cfg = window.APP_CONFIG;
  if (!YTD || !YTD.categories || !YTD.api || !cfg) {
    const msg = document.createElement('p');
    msg.className = 'fatal';
    msg.textContent = 'The app could not start: a script file failed to load. Check js/config.js, js/data.js and js/api.js.';
    document.body.prepend(msg);
    return;
  }

  const { categories, api, criteria, featureStatus } = YTD;
  const $ = (sel, root = document) => root.querySelector(sel);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const form = $('#discover-form');
  const catGrid = $('#category-grid');
  const catError = $('#category-error');
  const queryInput = $('#query');
  const counter = $('#query-counter');
  const submitBtn = $('#submit-btn');
  const submitLabel = $('.btn-label', submitBtn);
  const resultsSection = $('#results');
  const meta = $('#results-meta');
  const grid = $('#results-grid');
  const emptyState = $('#results-empty');
  const liveRegion = $('#results-status');

  let controller = null;

  /* ---------- helpers ---------- */
  function el(tag, props = {}, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'text') node.textContent = v;
      else if (k === 'class') node.className = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid);
    return node;
  }

  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const fmtCount = (n) => compact.format(n);

  function fmtAge(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    const days = Math.round((d.getTime() - Date.now()) / 86400000);
    const abs = Math.abs(days);
    if (abs < 1) return 'today';
    if (abs < 30) return rtf.format(days, 'day');
    if (abs < 365) return rtf.format(Math.round(days / 30), 'month');
    return rtf.format(Math.round(days / 365), 'year');
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDuration(sec) {
    if (sec == null) return '';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  }

  const announce = (text) => { liveRegion.textContent = text; };

  /* ---------- mode indicator ---------- */
  function renderMode() {
    const live = api.isLive();
    const pill = $('#mode-pill');
    pill.dataset.mode = live ? 'live' : 'demo';
    $('#mode-text').textContent = live ? 'Live mode · backend connected' : 'Demo mode · sample data only';
  }

  /* ---------- categories ---------- */
  function renderCategories() {
    const frag = document.createDocumentFragment();
    categories.forEach((c, i) => {
      const id = 'cat-' + c.id;
      const input = el('input', { type: 'radio', name: 'category', value: c.id, id });
      input.addEventListener('change', () => { catError.hidden = true; });
      frag.append(
        el('label', { class: 'cat-card', for: id, style: `--h:${c.hue};--i:${i}` },
          input,
          el('span', { class: 'cat-body' },
            el('span', { class: 'cat-icon', 'aria-hidden': 'true', text: c.icon }),
            el('span', { class: 'cat-name', text: c.name }),
            el('span', { class: 'cat-blurb', text: c.blurb })
          )
        )
      );
    });
    catGrid.replaceChildren(frag);
  }

  /* ---------- static sections ---------- */
  function renderCriteria() {
    $('#criteria-list').replaceChildren(...criteria.map((c) =>
      el('li', {},
        el('div', { class: 'crit-top' }, el('strong', { text: c.label }), el('span', { text: c.weight + '%' })),
        el('div', { class: 'bar', role: 'presentation' }, el('span', { style: `width:${c.weight}%` })),
        el('p', { text: c.desc })
      )
    ));
  }

  const STATE_LABEL = { working: 'Working', demo: 'Demo only', backend: 'Needs backend', ready: 'Backend URL set', future: 'Not built yet' };

  function renderStatus() {
    $('#status-list').replaceChildren(...featureStatus.map((f) => {
      const state = f.id === 'live-results' && api.isLive() ? 'ready' : f.state;
      return el('li', { class: 'status-item' },
        el('div', {},
          el('strong', { text: f.name }),
          el('p', { text: f.note })
        ),
        el('span', { class: 'tag tag-' + state, text: STATE_LABEL[state] })
      );
    }));
  }

  /* ---------- results ---------- */
  function videoCard(it, i) {
    const card = el('article', { class: 'video-card' + (it.sample ? ' is-sample' : ''), style: `--i:${i}` });
    const linkAttrs = { href: it.videoUrl, target: '_blank', rel: 'noopener noreferrer' };

    const thumb = el('a', { class: 'thumb', ...linkAttrs, 'aria-label': (it.sample ? 'Search YouTube: ' : 'Watch on YouTube: ') + it.title });
    if (it.sample) {
      thumb.classList.add('thumb--sample');
      thumb.style.setProperty('--h', it.hue);
      thumb.append(el('span', { class: 'sample-icon', 'aria-hidden': 'true', text: it.icon }));
    } else {
      const img = el('img', { src: it.thumbUrl, alt: '', loading: 'lazy', decoding: 'async', width: '480', height: '270' });
      img.addEventListener('error', () => { img.remove(); thumb.classList.add('thumb--missing'); });
      thumb.append(img);
      if (it.durationSeconds != null) thumb.append(el('span', { class: 'duration', text: fmtDuration(it.durationSeconds) }));
    }
    thumb.append(el('span', { class: 'rank', text: it.sample ? 'Sample ' + it.rank : '#' + it.rank }));

    const body = el('div', { class: 'card-body' });
    if (it.sample) body.append(el('span', { class: 'badge-sample', text: 'Demo sample · not a real video' }));
    body.append(el('h3', { class: 'card-title' }, el('a', { ...linkAttrs, text: it.title })));

    if (it.sample) {
      body.append(el('p', { class: 'channel muted', text: 'Opens a YouTube search for this idea' }));
      body.append(el('ul', { class: 'stats' }, el('li', { text: 'Statistics are not shown in demo mode' })));
    } else {
      body.append(it.channelUrl
        ? el('a', { class: 'channel', href: it.channelUrl, target: '_blank', rel: 'noopener noreferrer', text: it.channelTitle })
        : el('span', { class: 'channel', text: it.channelTitle }));
      const s = it.stats;
      const stats = [];
      if (s.views != null) stats.push(fmtCount(s.views) + ' views');
      if (s.likes != null) stats.push(fmtCount(s.likes) + ' likes');
      if (s.comments != null) stats.push(fmtCount(s.comments) + ' comments');
      const age = fmtAge(it.publishedAt);
      if (age) stats.push(age);
      body.append(el('ul', { class: 'stats' }, (stats.length ? stats : ['Statistics unavailable']).map((t) => el('li', { text: t }))));
    }

    card.append(thumb, body);
    return card;
  }

  function renderSkeletons(n) {
    grid.replaceChildren(...Array.from({ length: n }, (_, i) =>
      el('article', { class: 'video-card is-skeleton', 'aria-hidden': 'true', style: `--i:${i}` },
        el('div', { class: 'thumb skeleton' }),
        el('div', { class: 'card-body' },
          el('div', { class: 'sk-line skeleton' }),
          el('div', { class: 'sk-line short skeleton' }),
          el('div', { class: 'sk-line tiny skeleton' })
        )
      )
    ));
  }

  function renderResults(data, req) {
    const cat = categories.find((c) => c.id === req.category);
    const live = data.mode === 'live';
    emptyState.hidden = true;

    const metaParts = [
      el('div', { class: 'meta-head' },
        el('h3', { text: `Top ${req.limit} · ${cat.name}` }),
        el('span', { class: 'tag ' + (live ? 'tag-ready' : 'tag-demo'), text: live ? 'Live · YouTube Data API · India' : 'Demo samples' })
      ),
      req.q ? el('p', { class: 'muted', text: `For: “${req.q}”` }) : null,
      live
        ? el('p', { class: 'muted', text: [
            data.generatedAt ? `Ranked ${fmtDate(data.generatedAt)}${data.cached ? ' (cached)' : ''}` : null,
            data.refreshAfter ? `refreshes after ${fmtDate(data.refreshAfter)}` : null
          ].filter(Boolean).join(' · ') + ' — ' + 'ranking is based on available data and the selected criteria.' })
        : el('p', { class: 'notice' },
            'Demo mode: these cards are sample ideas that open a YouTube search. They are not ranked real videos and show no statistics. ',
            el('a', { href: '#status', text: 'See how to enable live results.' })
          ),
      el('p', { class: 'muted' }, el('a', { href: '#how', text: 'How is this ranked?' }))
    ];
    meta.replaceChildren(...metaParts.filter(Boolean)); // replaceChildren(null) would render the text "null"
    meta.hidden = false;

    if (!data.items.length) {
      grid.replaceChildren(el('div', { class: 'empty' }, el('p', { text: 'No videos matched. Try a broader description or another category.' })));
      announce('No results found.');
      return;
    }
    grid.replaceChildren(...data.items.map(videoCard));
    announce(`${data.items.length} results loaded for ${cat.name}.`);
  }

  const ERROR_COPY = {
    network:       ['Can’t reach the ranking service', 'Check your internet connection, or confirm the backend URL in js/config.js.'],
    timeout:       ['The service took too long', 'It may be busy. Please try again in a moment.'],
    quota_exceeded:['Daily YouTube quota reached', 'The backend has used its YouTube API quota for today. It resets daily (midnight Pacific Time). Cached rankings still work.'],
    not_configured:['Backend isn’t configured', 'The backend is running but has no YOUTUBE_API_KEY secret yet.'],
    server:        ['Something went wrong on the server', 'Please try again shortly.'],
    bad_response:  ['Unexpected response', 'The backend returned data in an unexpected format.']
  };

  function renderError(err, req) {
    const [title, text] = ERROR_COPY[err && err.code] || ERROR_COPY.server;
    meta.hidden = true;
    emptyState.hidden = true;
    grid.replaceChildren(
      el('div', { class: 'error-card', role: 'alert' },
        el('h3', { text: title }),
        el('p', { text }),
        el('div', { class: 'error-actions' },
          el('button', { type: 'button', class: 'btn btn-primary', 'data-action': 'retry', text: 'Try again' }),
          el('button', { type: 'button', class: 'btn btn-ghost', 'data-action': 'demo', text: 'Show demo samples instead' })
        )
      )
    );
    $('[data-action="retry"]', grid).addEventListener('click', () => runSearch(req));
    $('[data-action="demo"]', grid).addEventListener('click', async () => {
      renderResults(await api.discoverDemo(req), req);
    });
    announce(title);
  }

  /* ---------- search flow ---------- */
  function setBusy(busy) {
    submitBtn.disabled = busy;
    submitBtn.setAttribute('aria-busy', String(busy));
    submitLabel.textContent = busy ? 'Searching…' : 'Find videos';
    grid.setAttribute('aria-busy', String(busy));
  }

  function scrollToResults() {
    resultsSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    resultsSection.focus({ preventScroll: true });
  }

  async function runSearch(req) {
    if (controller) controller.abort();
    controller = new AbortController();
    const mine = controller;
    setBusy(true);
    emptyState.hidden = true;
    meta.hidden = true;
    renderSkeletons(req.limit);
    announce('Loading results…');
    scrollToResults();
    try {
      const data = await api.discover({ ...req, signal: mine.signal });
      if (mine !== controller) return;
      renderResults(data, req);
    } catch (err) {
      if (mine !== controller) return;
      renderError(err, req);
    } finally {
      if (mine === controller) setBusy(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const category = fd.get('category');
    if (!category) {
      catError.hidden = false;
      catGrid.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      return;
    }
    const q = String(fd.get('q') || '').replace(/\s+/g, ' ').trim().slice(0, cfg.MAX_QUERY_LENGTH || 120);
    const limit = fd.get('limit') === '10' ? 10 : 5;
    runSearch({ category, q, limit });
  });

  queryInput.addEventListener('input', () => {
    counter.textContent = `${queryInput.value.length} / ${queryInput.maxLength}`;
  });
  queryInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  /* ---------- page polish: reveal-on-scroll + active nav ---------- */
  function initObservers() {
    const reveals = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      reveals.forEach((n) => n.classList.add('in'));
      return;
    }
    const revealIO = new IntersectionObserver((entries, o) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); o.unobserve(e.target); } });
    }, { threshold: 0.1 });
    reveals.forEach((n) => revealIO.observe(n));

    const links = [...document.querySelectorAll('.nav a')];
    const navIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((a) => a.toggleAttribute('aria-current', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['discover', 'results', 'how', 'status'].forEach((id) => { const s = document.getElementById(id); if (s) navIO.observe(s); });
  }

  /* ---------- voice input (Web Speech API; hidden where unsupported) ---------- */
  const VOICE_ERR = {
    'not-allowed': 'Microphone permission is blocked. Allow it in your browser’s site settings.',
    'service-not-allowed': 'Speech recognition is blocked on this browser or device.',
    'no-speech': 'Didn’t catch anything. Tap the mic and try again.',
    'audio-capture': 'No microphone found.',
    'network': 'Voice input needs an internet connection.',
    'language-not-supported': 'This language is not supported for voice input here.'
  };

  function initVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const box = $('#voice');
    if (!Recognition || !box) return;
    const btn = $('#voice-btn');
    const langBtn = $('#voice-lang');
    const status = $('#voice-status');
    const LANGS = [
      { code: 'hi-IN', label: 'हि', name: 'Hindi' },
      { code: 'en-IN', label: 'EN', name: 'English (India)' }
    ];
    let li = 0;
    try {
      const i = LANGS.findIndex((l) => l.code === localStorage.getItem('ww-voice-lang'));
      if (i >= 0) li = i;
    } catch (_) { /* storage unavailable */ }

    let rec = null;
    let hadError = false;
    let base = '';

    const say = (t) => { status.textContent = t; };
    const paintLang = () => {
      langBtn.textContent = LANGS[li].label;
      langBtn.setAttribute('aria-label', `Voice language: ${LANGS[li].name}. Tap to change.`);
      langBtn.title = `Voice language: ${LANGS[li].name}`;
    };
    const setListening = (on) => {
      btn.setAttribute('aria-pressed', String(on));
      box.classList.toggle('is-listening', on);
    };
    const stop = () => { if (rec) { try { rec.stop(); } catch (_) { /* already stopped */ } } };

    function start() {
      hadError = false;
      base = queryInput.value.trim();
      rec = new Recognition();
      rec.lang = LANGS[li].code;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => { setListening(true); say(`Listening (${LANGS[li].name})… speak now`); };
      rec.onresult = (e) => {
        let text = '';
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        queryInput.value = ((base ? base + ' ' : '') + text.trim()).slice(0, queryInput.maxLength);
        queryInput.dispatchEvent(new Event('input'));
      };
      rec.onerror = (e) => {
        if (e.error === 'aborted') return;
        hadError = true;
        say(VOICE_ERR[e.error] || 'Voice input failed. Please try again or type instead.');
      };
      rec.onend = () => {
        setListening(false);
        if (!hadError) say(queryInput.value.trim() ? 'Done — edit the text if needed, then press Find videos.' : '');
        rec = null;
      };
      try { rec.start(); } catch (_) { setListening(false); say('Could not start voice input. Please try again.'); }
    }

    btn.addEventListener('click', () => (rec ? stop() : start()));
    langBtn.addEventListener('click', () => {
      if (rec) stop();
      li = (li + 1) % LANGS.length;
      try { localStorage.setItem('ww-voice-lang', LANGS[li].code); } catch (_) { /* ignore */ }
      paintLang();
      say(`Voice language: ${LANGS[li].name}`);
    });

    paintLang();
    box.hidden = false;
    $('#input-wrap').classList.add('has-voice');
    $('#voice-note').hidden = false;
  }

  /* ---------- init ---------- */
  initVoice();
  renderMode();
  renderCategories();
  renderCriteria();
  renderStatus();
  $('#year').textContent = new Date().getFullYear();
  initObservers();
})();
