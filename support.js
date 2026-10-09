/* Placeholder pages in the sign-in layout, in the chosen language:
   support.html?topic=forgot-password|privacy|help, and first-login.html (S03).
   They say plainly what isn't built yet — no recovery email is sent from here. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const i18n = window.NexoraI18n;
  const { routes } = store;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const page = document.body.dataset.page;
  const t = (key, vars) => i18n.t(key, vars);
  const TOPICS = { 'forgot-password': ['forgotTitle', 'forgotText'], privacy: ['privacyTitle', 'privacyText'], help: ['helpTitle', 'helpText'] };

  i18n.setLocale(i18n.locale());
  const school = store.school;
  document.querySelector('[data-school-name]').textContent = school.name;
  document.querySelector('[data-school-logo]').innerHTML = `<img src="${esc(school.logo)}" alt="" width="72" height="72">`;
  const wrap = document.querySelector('[data-note]');

  if (page === 'first-login') {
    // S03 is only for a signed-in user whose profile says this is their first sign-in.
    if (!store.session.isSignedIn()) { location.replace(routes.signIn()); return; }
    const user = store.currentUser();
    if (!store.isFirstLogin(user)) { location.replace(routes.landing); return; }
    document.title = `${t('firstTitle', { name: user.name })} · ${school.name}`;
    wrap.innerHTML = `
      <span class="auth-note__label">S03 · ${esc(t('placeholderLabel'))}</span>
      <h1 class="auth__title">${esc(t('firstTitle', { name: user.name }))}</h1>
      <p class="auth-note__text">${esc(t('firstText'))}</p>
      <button class="btn btn--block auth-btn" type="button" data-continue>${esc(t('firstContinue'))}</button>`;
    wrap.querySelector('[data-continue]').addEventListener('click', () => {
      store.completeFirstLogin(user);
      location.replace(routes.landing);
    });
    return;
  }

  const [titleKey, textKey] = TOPICS[new URLSearchParams(location.search).get('topic')] || TOPICS.help;
  document.title = `${t(titleKey)} · ${school.name}`;
  wrap.innerHTML = `
    <span class="auth-note__label">${esc(t('placeholderLabel'))}</span>
    <h1 class="auth__title">${esc(t(titleKey))}</h1>
    <p class="auth-note__text">${esc(t(textKey))}</p>
    <a class="btn btn--block auth-btn" href="${routes.signIn()}">${esc(t('backToSignIn'))}</a>`;
})();
