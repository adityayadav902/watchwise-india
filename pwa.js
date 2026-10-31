/* PWA: service worker registration + "Install app" button (shown only when the browser offers installation). */
(function () {
  'use strict';
  const btn = document.getElementById('install-btn');
  let deferred = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    if (btn) btn.hidden = false;
  });

  if (btn) {
    btn.addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (_) { /* dismissed */ }
      deferred = null;
      btn.hidden = true;
    });
  }

  window.addEventListener('appinstalled', () => {
    deferred = null;
    if (btn) btn.hidden = true;
  });

  const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed:', err));
    });
  }
})();
