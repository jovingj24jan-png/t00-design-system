/* DEMO AUTHENTICATION — prototype only, not secure.
   Checks credentials in the browser against the demo users in store.js and keeps the
   failed-attempt lockout in localStorage. Anyone can read this file or edit storage, so none
   of it protects anything. In production, replace NexoraAuth.signIn with a call to the real
   authentication API, which must check the password, the school's status and the lockout on
   the server. Keep the result shape ({ ok, reason, user, firstLogin }) and signin.js needs no change. */
(() => {
  'use strict';

  const store = window.NexoraStore;

  // Demo-only password shared by every demo account (documented on the sign-in page).
  const DEMO_PASSWORD = 'montessori123';
  const MAX_FAILURES = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;
  const DEMO_DELAY_MS = 1000;
  const guardKey = schoolId => `nexora-signin-guard:${schoolId}`;

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
    if (!user || password !== DEMO_PASSWORD) {
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

  // SSO has no identity provider behind it yet: never reports success.
  async function signInWithSso() {
    await wait(400);
    return { ok: false, reason: 'sso-not-connected' };
  }

  window.NexoraAuth = { signIn, signInWithSso, lockState, MAX_FAILURES, LOCKOUT_MS, demoPassword: DEMO_PASSWORD };
})();
