/* DEMO AUTHENTICATION — prototype only, not secure.
   Checks credentials in the browser against the demo users in store.js and keeps the
   failed-attempt lockout in localStorage. Anyone can read this file or edit storage, so none
   of it protects anything. In production, replace NexoraAuth.signIn with a call to the real
   authentication API, which must check the password, the school's status and the lockout on
   the server. Keep the result shape ({ ok, reason, user, firstLogin }) and signin.js needs no change.

   PASSWORD RECOVERY (S02) is mocked here too: no email is sent. Reset tokens live only in this
   page's memory (never in storage or logs), last 30 minutes and work once. A reset stores a
   salted PBKDF2 hash of the new demo password (never the password itself) in localStorage, so
   the demo account can sign in with it. It does not change any real account. */
(() => {
  'use strict';

  const store = window.NexoraStore;

  // Demo-only password shared by every demo account (documented on the sign-in page).
  const DEMO_PASSWORD = 'montessori123';
  const MAX_FAILURES = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;
  const DEMO_DELAY_MS = 1000;
  const guardKey = schoolId => `nexora-signin-guard:${schoolId}`;
  const CREDENTIALS_KEY = 'nexora-demo-credentials';
  const FLOW_KEY = 'nexora-reset-flow';
  const HANDOFF_KEY = 'nexora-signin-handoff';
  const RESET_TTL_MS = 30 * 60 * 1000;
  const RESEND_GAP_MS = 30 * 1000;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const digits = s => String(s).replace(/\D/g, '');
  // Email compares case-insensitively; phone compares the last 10 digits, so "+91 98400 11111"
  // and "9840011111" both match.
  function matches(user, identifier) {
    const id = String(identifier).trim();
    if (id.includes('@')) return user.email.toLowerCase() === id.toLowerCase();
    const d = digits(id);
    return d.length >= 10 && digits(user.phone).slice(-10) === d.slice(-10);
  }

  function readGuard(schoolId) {
    try { return JSON.parse(localStorage.getItem(guardKey(schoolId))) || { failures: 0, lockedUntil: 0 }; } catch { return { failures: 0, lockedUntil: 0 }; }
  }
  function writeGuard(schoolId, guard) {
    try { localStorage.setItem(guardKey(schoolId), JSON.stringify(guard)); } catch { /* lockout can't persist */ }
  }

  // Policy: after a lockout ends, the failure count starts again from zero.
  function lockState(schoolId, now = Date.now()) {
    const guard = readGuard(schoolId);
    if (guard.lockedUntil && guard.lockedUntil <= now) {
      writeGuard(schoolId, { failures: 0, lockedUntil: 0 });
      return { locked: false, failures: 0, lockedUntil: 0 };
    }
    return { locked: guard.lockedUntil > now, failures: guard.failures, lockedUntil: guard.lockedUntil };
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Resolves after the demo delay. reason: 'invalid' | 'locked' | 'paused'.
  async function signIn({ schoolId, identifier, password }) {
    await wait(DEMO_DELAY_MS);
    const school = store.schoolById(schoolId);
    if (!school) return { ok: false, reason: 'invalid' };
    if (school.status === 'paused') return { ok: false, reason: 'paused' };

    const state = lockState(schoolId);
    if (state.locked) return { ok: false, reason: 'locked', lockedUntil: state.lockedUntil };

    const user = store.users.find(u => u.schoolId === schoolId && matches(u, identifier));
    // Same result whether the account is unknown or the password is wrong.
    if (!user || !(await passwordMatches(user, password))) {
      const failures = state.failures + 1;
      if (failures >= MAX_FAILURES) {
        const lockedUntil = Date.now() + LOCKOUT_MS;
        writeGuard(schoolId, { failures, lockedUntil });
        return { ok: false, reason: 'locked', lockedUntil };
      }
      writeGuard(schoolId, { failures, lockedUntil: 0 });
      return { ok: false, reason: 'invalid' };
    }

    writeGuard(schoolId, { failures: 0, lockedUntil: 0 });
    return { ok: true, user, firstLogin: store.isFirstLogin(user) };
  }

  /* ------------------------------------------------------------ Demo credential store */

  const readJson = (storage, key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const writeJson = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const toHex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
  const randomHex = n => toHex(crypto.getRandomValues(new Uint8Array(n)));

  async function hashPassword(password, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return toHex(bits);
  }
  // A reset password (stored as a hash) replaces the shared demo password for that account.
  async function passwordMatches(user, password) {
    const record = readJson(localStorage, CREDENTIALS_KEY, {})[user.id];
    if (!record) return password === DEMO_PASSWORD;
    return (await hashPassword(password, record.salt)) === record.hash;
  }

  /* ------------------------------------------------------------ Password recovery (S02, mock) */

  // Same rules the page shows. The server must enforce its own copy of these in production.
  // "Symbol" = any character that is not a letter, a number or a space.
  const passwordRules = {
    length: pw => [...pw].length >= 8,
    number: pw => /\p{N}/u.test(pw),
    symbol: pw => /[^\p{L}\p{N}\s]/u.test(pw),
    upper: pw => /\p{Lu}/u.test(pw)
  };
  const meetsRules = pw => Object.values(passwordRules).every(rule => rule(pw));

  const tokens = new Map();   // token -> { userId, email, expires, used }   (memory only)
  const inbox = new Map();    // email -> latest token: what the demo "email" would contain
  const lastRequest = new Map();

  // Resolves the same way whether or not the email belongs to an account.
  async function requestPasswordReset({ schoolId, email }) {
    await wait(800);
    const address = String(email).trim().toLowerCase();
    if (!EMAIL_RE.test(address)) return { ok: false, reason: 'invalid-email' };
    const now = Date.now();
    const last = lastRequest.get(address) || 0;
    if (now - last < RESEND_GAP_MS) return { ok: false, reason: 'rate-limited', retryAt: last + RESEND_GAP_MS };
    lastRequest.set(address, now);
    const user = store.users.find(u => u.schoolId === schoolId && u.email.toLowerCase() === address);
    if (user) {
      // A new link replaces any earlier one for this account.
      for (const [token, record] of tokens) if (record.userId === user.id) tokens.delete(token);
      const token = randomHex(32);
      tokens.set(token, { userId: user.id, email: user.email, expires: now + RESET_TTL_MS, used: false });
      inbox.set(address, token);
    }
    return { ok: true, resendAt: now + RESEND_GAP_MS };
  }

  // DEMO ONLY: stands in for clicking the link in the email. Null when no email was "sent".
  async function openDemoResetLink(email) {
    await wait(300);
    return inbox.get(String(email).trim().toLowerCase()) || null;
  }

  function checkResetToken(token) {
    const record = token && tokens.get(token);
    return Boolean(record && !record.used && record.expires > Date.now());
  }

  async function resetPassword({ token, password }) {
    await wait(900);
    if (!checkResetToken(token)) return { ok: false, reason: 'invalid-token' };
    if (!meetsRules(password)) return { ok: false, reason: 'weak-password' };
    const record = tokens.get(token);
    const salt = randomHex(16);
    const credentials = readJson(localStorage, CREDENTIALS_KEY, {});
    credentials[record.userId] = { salt, hash: await hashPassword(password, salt) };
    if (!writeJson(localStorage, CREDENTIALS_KEY, credentials)) return { ok: false, reason: 'error' };
    record.used = true; // single use
    tokens.delete(token);
    inbox.delete(record.email.toLowerCase());
    return { ok: true, email: record.email };
  }

  // Non-sensitive flow state (email + step) for Back/refresh within S02. Never a token or password.
  const recoveryFlow = {
    read: () => readJson(sessionStorage, FLOW_KEY, null),
    save: state => writeJson(sessionStorage, FLOW_KEY, state),
    clear: () => { try { sessionStorage.removeItem(FLOW_KEY); } catch { /* nothing to clear */ } }
  };

  // One-time message from S02 to S01 (email to prefill, toast to show). Read once, then removed.
  function handOffToSignIn(data) { writeJson(sessionStorage, HANDOFF_KEY, data); }
  function takeSignInHandoff() {
    const data = readJson(sessionStorage, HANDOFF_KEY, null);
    try { sessionStorage.removeItem(HANDOFF_KEY); } catch { /* ignore */ }
    return data;
  }

  // SSO has no identity provider behind it yet: never reports success.
  async function signInWithSso() {
    await wait(400);
    return { ok: false, reason: 'sso-not-connected' };
  }

  window.NexoraAuth = {
    signIn, signInWithSso, lockState, MAX_FAILURES, LOCKOUT_MS, demoPassword: DEMO_PASSWORD,
    passwordRules, meetsRules, requestPasswordReset, openDemoResetLink, checkResetToken, resetPassword,
    recoveryFlow, handOffToSignIn, takeSignInHandoff, RESEND_GAP_MS, EMAIL_RE
  };
})();
