/* Connectivity banner + offline helpers: NexoraConnectivity.init(), .isOnline(), .requireOnline(), .destroy().
   navigator.onLine only says whether the browser has a network connection. It does not mean the
   school's server is reachable, so "Back online" never claims anything was synced or saved remotely. */
(() => {
  'use strict';

  const BACK_ONLINE_MS = 3000;
  const WIFI_OFF = `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M19 12.9a10 10 0 0 0-1.9-1.5"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8A15 15 0 0 0 11 5"/><path d="M12 20h.01"/></svg>`;
  const WIFI_ON = `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12.9a10 10 0 0 1 14 0"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M2 8.8a15 15 0 0 1 20 0"/><path d="M12 20h.01"/></svg>`;

  let el = null;
  let timer = null;
  let online = navigator.onLine;

  function render(state) {
    clearTimeout(timer);
    if (state === 'offline') {
      el.className = 'netbar is-offline is-visible';
      el.innerHTML = `${WIFI_OFF}<p class="netbar__text"><span class="netbar__long">You're offline — changes will be saved on this device.</span><span class="netbar__short">Offline — changes saved on device</span></p>`;
    } else if (state === 'back') {
      el.className = 'netbar is-online is-visible';
      el.innerHTML = `${WIFI_ON}<p class="netbar__text">Back online</p>`;
      timer = setTimeout(() => render('hidden'), BACK_ONLINE_MS);
    } else {
      el.classList.remove('is-visible');
    }
  }

  const onOffline = () => { online = false; render('offline'); };
  const onOnline = () => { online = true; render('back'); };

  // Idempotent: a second call (shell + page script) never adds a second banner or listener.
  function init() {
    if (el) return;
    el = document.createElement('div');
    el.id = 'netbar';
    el.className = 'netbar';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    if (document.getElementById('sidebar')) el.dataset.offset = 'sidebar';
    document.body.appendChild(el);
    addEventListener('offline', onOffline);
    addEventListener('online', onOnline);
    online = navigator.onLine;
    if (!online) render('offline');
  }

  function destroy() {
    removeEventListener('offline', onOffline);
    removeEventListener('online', onOnline);
    clearTimeout(timer);
    el?.remove();
    el = null;
  }

  // For actions that can't be completed safely offline. Returns true when the caller may go on.
  // `show` lets a caller put the message inside an open dialog, where a toast would be hidden.
  function requireOnline(action, show) {
    if (navigator.onLine) return true;
    const text = `${action} needs a connection. Nothing was saved. Try again when you're back online.`;
    if (show) show(text); else window.NexoraToast?.show("You're offline", text, 'info');
    return false;
  }

  window.NexoraConnectivity = { init, destroy, requireOnline, isOnline: () => navigator.onLine };
})();
