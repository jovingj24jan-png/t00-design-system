/* S04 Dashboard — "What needs my attention today?"
   Every number is derived from NexoraStore on each render; nothing here holds its own copy of
   school records. Widgets are filtered by role (canAccess) and plan (isEntitled), and the page
   re-renders in place on store changes and demo-role switches, replacing only widgets whose
   content changed. Test hook: dashboard.html?fail=<widgetId> makes that widget fail once. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const { routes } = store;
  const flows = window.NexoraWorkflows;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = n => `₹${Math.round(n).toLocaleString('en-IN')}`;
  const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const pageUrl = (key, params = {}) => {
    const q = new URLSearchParams(params).toString();
    return `${routes.page(key)}${q ? `&${q}` : ''}`;
  };
  const time = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const dayLabel = iso => {
    const d = iso.slice(0, 10);
    const diff = Math.round((new Date(`${d}T00:00:00`) - new Date(`${store.today()}T00:00:00`)) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === -1) return 'Yesterday';
    if (diff === 1) return 'Tomorrow';
    return new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (!store.session.isSignedIn()) {
    location.replace(routes.signIn({ next: `dashboard.html${location.search}` }));
    return;
  }

  const main = document.getElementById('content');
  const failOnce = new Set((new URLSearchParams(location.search).get('fail') || '').split(',').filter(Boolean));

  /* ------------------------------------------------------------ Data selectors (pure, read from the store) */

  function attendanceSummary(user) {
    const scope = store.classScope(user);
    const reg = store.getRegister();
    const taken = scope.filter(c => reg[c]);
    const counts = { present: 0, late: 0, absent: 0, enrolled: 0 };
    taken.forEach(c => Object.values(reg[c].marks).forEach(m => { counts[m] += 1; counts.enrolled += 1; }));
    const perClass = scope.map(c => {
      const pupils = store.roster.filter(s => s.cls === c).length;
      if (!reg[c]) return { cls: c, pupils, taken: false };
      const m = Object.values(reg[c].marks);
      return { cls: c, pupils, taken: true, present: m.filter(x => x === 'present').length, late: m.filter(x => x === 'late').length, absent: m.filter(x => x === 'absent').length, takenAt: reg[c].takenAt, takenBy: reg[c].takenBy };
    });
    return { scope, taken, missing: scope.filter(c => !reg[c]), counts, perClass };
  }

  /* ------------------------------------------------------------ Widget catalogue
     group: mobile priority (attendance → actions → kpi → chart → list).
     size: kpi (3 of 12) · half (6) · full (12). mandatory: can't be hidden (safety). */

  const kpi = ({ href, iconName, label, value, context = '', flag = null, tone = '', unavailable = false }) => `
    <a class="kpi${tone ? ` kpi--${tone}` : ''}${unavailable ? ' is-unavailable' : ''}" href="${href}">
      <span class="kpi__top"><span class="kpi__icon" aria-hidden="true">${icon(iconName)}</span><span class="kpi__label">${esc(label)}</span>${icon('arrow-right', 'kpi__go')}</span>
      <span class="kpi__value">${value}</span>
      ${context ? `<span class="kpi__context">${context}</span>` : ''}
      ${flag ? `<span class="kpi__flag kpi__flag--${flag.tone}">${icon(flag.icon, 'icon--sm')}${esc(flag.text)}</span>` : ''}
    </a>`;

  const cardHead = (title, sub, linkHref, linkText) => `
    <header class="dcard__head">
      <div><h2 class="dcard__title">${esc(title)}</h2>${sub ? `<p class="dcard__sub">${sub}</p>` : ''}</div>
      ${linkHref ? `<a class="btn btn--tertiary btn--sm" href="${linkHref}">${esc(linkText)}${icon('arrow-right', 'icon--sm')}</a>` : ''}
    </header>`;

  const empty = (iconName, title, text) => `
    <div class="dcard__empty"><span class="state-icon" aria-hidden="true">${icon(iconName)}</span><p class="dcard__empty-title">${esc(title)}</p><p class="dcard__empty-text">${esc(text)}</p></div>`;

  const WIDGETS = [
    {
      id: 'attendance', name: 'Children on site', module: 'attendance', group: 'attendance', size: 'kpi',
      render(user) {
        const a = attendanceSummary(user);
        if (!a.scope.length) return kpi({ href: pageUrl('attendance'), iconName: 'users', label: 'Children on site', value: '—', context: 'No classes assigned to you', unavailable: true });
        if (!a.taken.length) return kpi({ href: pageUrl('attendance', { status: 'not-taken' }), iconName: 'users', label: 'Children on site', value: '—', context: 'No registers taken yet', unavailable: true, flag: { tone: 'warn', icon: 'clock', text: 'Waiting for registers' } });
        const onSite = a.counts.present + a.counts.late;
        const pct = Math.round((onSite / a.counts.enrolled) * 100);
        return kpi({ href: pageUrl('attendance'), iconName: 'users', label: 'Children on site', value: onSite, context: `of ${a.counts.enrolled} in ${plural(a.taken.length, 'register')} · ${pct}%` });
      }
    },
    {
      id: 'absent', name: 'Absent today', module: 'attendance', group: 'attendance', size: 'kpi',
      render(user) {
        const a = attendanceSummary(user);
        const href = pageUrl('attendance', { status: 'absent' });
        if (!a.taken.length) return kpi({ href, iconName: 'calendar-check', label: 'Absent today', value: '—', context: 'Known once registers are taken', unavailable: true });
        return kpi({
          href, iconName: 'calendar-check', label: 'Absent today', value: a.counts.absent,
          context: `${plural(a.counts.late, 'late arrival')}`,
          flag: a.counts.absent ? { tone: 'info', icon: 'phone', text: 'Check absence reasons' } : { tone: 'ok', icon: 'check-circle', text: 'Everyone is in' }
        });
      }
    },
    {
      id: 'registers', name: 'Registers taken', module: 'attendance', group: 'attendance', size: 'kpi',
      render(user) {
        const a = attendanceSummary(user);
        if (!a.scope.length) return kpi({ href: pageUrl('attendance'), iconName: 'check-circle', label: 'Registers taken', value: '—', context: 'No classes assigned to you', unavailable: true });
        const done = !a.missing.length;
        return kpi({
          href: pageUrl('attendance', done ? {} : { status: 'not-taken' }), iconName: 'check-circle', label: 'Registers taken',
          value: `${a.taken.length}<small>/${a.scope.length}</small>`,
          context: done ? 'All attendance is up to date' : `Not taken: ${esc(a.missing.join(', '))}`,
          tone: done ? '' : 'warn',
          flag: done ? { tone: 'ok', icon: 'check', text: 'Complete' } : { tone: 'warn', icon: 'alert-triangle', text: `${plural(a.missing.length, 'register')} to take` }
        });
      }
    },
    {
      id: 'staff', name: 'Staff on duty', module: 'attendance', group: 'attendance', size: 'kpi', when: user => store.canManageStaff(user),
      render() {
        const att = store.getStaffAttendance();
        const recorded = store.educators.filter(e => att[e.id]);
        const href = pageUrl('attendance', { view: 'staff' });
        if (!recorded.length) return kpi({ href, iconName: 'user', label: 'Staff on duty', value: '—', context: 'Staff attendance not recorded', unavailable: true });
        const away = store.educators.filter(e => att[e.id] === 'absent');
        return kpi({
          href, iconName: 'user', label: 'Staff on duty', value: `${recorded.length - away.length}<small>/${store.educators.length}</small>`,
          context: away.length ? `Away: ${esc(away.map(e => e.name).join(', '))}` : 'Every educator is in',
          flag: recorded.length < store.educators.length ? { tone: 'warn', icon: 'clock', text: `${store.educators.length - recorded.length} not recorded` } : null
        });
      }
    },
    {
      id: 'enquiries', name: 'Open enquiries', module: 'admissions', group: 'kpi', size: 'kpi',
      render() {
        const open = store.getAdmissionEnquiries().filter(store.isOpenEnquiry);
        const due = open.filter(store.followUpDue);
        return kpi({
          href: pageUrl('admissions', { status: 'open' }), iconName: 'user-plus', label: 'Open enquiries', value: open.length,
          context: open.length ? `${plural(open.filter(e => e.status === 'new').length, 'new enquiry', 'new enquiries')}` : 'No enquiries in progress',
          flag: due.length ? { tone: 'warn', icon: 'phone', text: `${plural(due.length, 'follow-up')} due` } : null
        });
      }
    },
    {
      id: 'fees', name: 'Fees outstanding', module: 'fees', group: 'kpi', size: 'kpi',
      render() {
        const due = store.feeLedger().filter(l => l.balance > 0);
        const overdue = due.filter(l => l.overdue);
        return kpi({
          href: pageUrl('fees', { status: 'outstanding' }), iconName: 'wallet', label: 'Fees outstanding',
          value: money(due.reduce((s, l) => s + l.balance, 0)),
          context: due.length ? `${plural(due.length, 'child', 'children')} · ${esc(store.TERM)}` : `Everything paid for ${esc(store.TERM)}`,
          flag: overdue.length ? { tone: 'warn', icon: 'clock', text: `${overdue.length} overdue` } : null
        });
      }
    },
    {
      id: 'incidents', name: 'Open incidents', module: 'safeguarding', group: 'kpi', size: 'kpi',
      render() {
        const open = store.getIncidents().filter(i => i.status === 'open');
        const untold = open.filter(i => !i.parentInformed);
        const high = open.filter(i => i.severity === 'High');
        return kpi({
          href: pageUrl('safeguarding', { status: 'open' }), iconName: 'shield-check', label: 'Open incidents', value: open.length,
          context: open.length ? `${open.filter(i => i.occurredAt.slice(0, 10) === store.today()).length} today` : 'No incidents need follow-up',
          tone: high.length ? 'alert' : '',
          flag: high.length ? { tone: 'alert', icon: 'alert-triangle', text: `${high.length} high severity` }
            : untold.length ? { tone: 'warn', icon: 'phone', text: `Parent not told: ${untold.length}` } : null
        });
      }
    },
    {
      id: 'ratio', name: 'Class ratios', module: 'attendance', group: 'attendance', size: 'half', mandatory: true,
      render(user) {
        const rows = store.ratioStatus(user);
        const breaches = rows.filter(r => r.status === 'breach');
        const body = rows.length ? `
          <ul class="ratio-list">
            ${rows.map(r => {
              const label = r.status === 'breach' ? 'Over ratio' : r.status === 'ok' ? 'Within ratio' : 'Unavailable';
              const detail = r.status === 'unavailable' ? esc(r.reason)
                : `${plural(r.children, 'child', 'children')} · ${plural(r.educators, 'educator')} on duty${r.status === 'breach' ? ` · needs ${r.required - r.educators} more` : ''}`;
              return `
                <li><a class="ratio-row ratio-row--${r.status}" href="${pageUrl('attendance', { view: 'ratio', cls: r.cls })}">
                  <span class="ratio-row__main"><span class="ratio-row__cls">${esc(r.cls)}</span><span class="ratio-row__detail">${detail}</span></span>
                  <span class="ratio-row__figure">${r.status === 'unavailable' ? '—' : r.educators ? `${Math.round((r.children / r.educators) * 10) / 10}:1` : `${r.children}:0`}<small>${Number.isFinite(r.limit) ? `limit ${r.limit}:1` : 'no limit'}</small></span>
                  <span class="badge ${r.status === 'breach' ? 'badge--error badge--absent' : r.status === 'ok' ? 'badge--success' : 'badge--late'}">${r.status === 'breach' ? icon('alert-triangle', 'icon--sm') : ''}${label}</span>
                </a></li>`;
            }).join('')}
          </ul>`
          : empty('grid', 'No classes to check', 'Ratios appear for the classes you’re assigned to.');
        return `<div class="dcard">${cardHead('Class ratios', breaches.length ? `<strong class="text-error">${plural(breaches.length, 'class', 'classes')} over ratio</strong> · children per educator on duty` : 'Children per educator on duty, live', pageUrl('attendance', { view: 'ratio' }), 'Staffing')}${body}</div>`;
      }
    },
    {
      id: 'attendance-chart', name: 'Attendance by class', module: 'attendance', group: 'chart', size: 'half',
      render(user) {
        const a = attendanceSummary(user);
        if (!a.perClass.length) return `<div class="dcard">${cardHead('Attendance by class', '')}${empty('calendar-check', 'No classes yet', 'Attendance by class appears once classes have children.')}</div>`;
        const legend = `<ul class="legend" aria-hidden="true"><li><i class="legend__key legend__key--present"></i>Present</li><li><i class="legend__key legend__key--late"></i>Late</li><li><i class="legend__key legend__key--absent"></i>Absent</li></ul>`;
        const bars = a.perClass.map(c => {
          if (!c.taken) return `<li><a class="hbar hbar--empty" href="${pageUrl('attendance', { cls: c.cls })}" data-tip="${esc(`${c.cls}: register not taken yet`)}"><span class="hbar__label">${esc(c.cls)}</span><span class="hbar__track"><span class="hbar__note">Register not taken</span></span><span class="hbar__value">—</span></a></li>`;
          const seg = (k, n) => (n ? `<span class="hbar__seg hbar__seg--${k}" style="--w:${(n / c.pupils) * 100}%"></span>` : '');
          return `<li><a class="hbar" href="${pageUrl('attendance', { cls: c.cls })}" data-tip="${esc(`${c.cls}: ${c.present} present, ${c.late} late, ${c.absent} absent · taken ${time(c.takenAt)} by ${c.takenBy}`)}"><span class="hbar__label">${esc(c.cls)}</span><span class="hbar__track">${seg('present', c.present)}${seg('late', c.late)}${seg('absent', c.absent)}</span><span class="hbar__value">${c.present + c.late}/${c.pupils}</span></a></li>`;
        }).join('');
        const table = `<table class="sr-only"><caption>Attendance by class today</caption><thead><tr><th scope="col">Class</th><th scope="col">Present</th><th scope="col">Late</th><th scope="col">Absent</th></tr></thead><tbody>${a.perClass.map(c => `<tr><th scope="row">${esc(c.cls)}</th>${c.taken ? `<td>${c.present}</td><td>${c.late}</td><td>${c.absent}</td>` : '<td colspan="3">Register not taken</td>'}</tr>`).join('')}</tbody></table>`;
        return `<figure class="dcard">${cardHead('Attendance by class', 'Today · children on site of enrolled', pageUrl('attendance'), 'Attendance')}${legend}<ul class="hbars" aria-hidden="true">${bars}</ul>${table}</figure>`;
      }
    },
    {
      id: 'fees-chart', name: 'Fee collection by class', module: 'fees', group: 'chart', size: 'half',
      render() {
        const ledger = store.feeLedger();
        const byClass = store.rosterClasses.map(c => {
          const lines = ledger.filter(l => l.student.cls === c.name);
          const billed = lines.reduce((s, l) => s + l.amount, 0);
          const paid = lines.reduce((s, l) => s + l.paid, 0);
          return { cls: c.name, billed, paid, due: billed - paid, count: lines.filter(l => l.balance > 0).length };
        }).filter(c => c.billed > 0);
        if (!byClass.length) return `<div class="dcard">${cardHead('Fee collection', '')}${empty('wallet', 'No fees billed yet', `Invoices for ${store.TERM} will show here.`)}</div>`;
        const total = byClass.reduce((s, c) => s + c.billed, 0);
        const paid = byClass.reduce((s, c) => s + c.paid, 0);
        const bars = byClass.map(c => `<li><a class="hbar" href="${pageUrl('fees', { status: 'outstanding', cls: c.cls })}" data-tip="${esc(`${c.cls}: ${money(c.paid)} of ${money(c.billed)} collected · ${money(c.due)} due from ${plural(c.count, 'child', 'children')}`)}"><span class="hbar__label">${esc(c.cls)}</span><span class="hbar__track"><span class="hbar__seg hbar__seg--paid" style="--w:${(c.paid / c.billed) * 100}%"></span></span><span class="hbar__value">${Math.round((c.paid / c.billed) * 100)}%</span></a></li>`).join('');
        const table = `<table class="sr-only"><caption>Fee collection by class, ${esc(store.TERM)}</caption><thead><tr><th scope="col">Class</th><th scope="col">Collected</th><th scope="col">Billed</th><th scope="col">Due</th></tr></thead><tbody>${byClass.map(c => `<tr><th scope="row">${esc(c.cls)}</th><td>${money(c.paid)}</td><td>${money(c.billed)}</td><td>${money(c.due)}</td></tr>`).join('')}</tbody></table>`;
        return `<figure class="dcard">${cardHead('Fee collection', `${esc(store.TERM)} · ${money(paid)} of ${money(total)} collected (${Math.round((paid / total) * 100)}%)`, pageUrl('fees', { status: 'outstanding' }), 'Fees')}<ul class="hbars" aria-hidden="true">${bars}</ul>${table}</figure>`;
      }
    },
    {
      id: 'followups', name: 'Enquiry follow-ups', module: 'admissions', group: 'list', size: 'half',
      render() {
        const open = store.getAdmissionEnquiries().filter(store.isOpenEnquiry).sort((a, b) => (a.followUp || '9').localeCompare(b.followUp || '9'));
        const list = open.slice(0, 4);
        const body = list.length ? `<ul class="dlist">${list.map(e => {
          const due = store.followUpDue(e);
          const overdue = due && e.followUp < store.today();
          return `<li class="dlist__item"><span class="avatar avatar--sm avatar--info" aria-hidden="true">${esc(window.NexoraShell.initials(e.child))}</span>
            <div class="dlist__main"><p class="dlist__title">${esc(e.child)} <span class="dlist__muted">· ${esc(e.programme)}</span></p><p class="dlist__sub">${esc(e.parent)} · <a href="tel:${esc(e.phone.replace(/\s/g, ''))}">${esc(e.phone)}</a></p></div>
            ${e.followUp ? `<span class="badge ${overdue ? 'badge--error badge--absent' : due ? 'badge--warning badge--late' : ''}">${overdue ? 'Overdue' : due ? 'Today' : esc(dayLabel(e.followUp))}</span>` : `<span class="badge">${esc(store.ENQUIRY_STATUSES[e.status])}</span>`}</li>`;
        }).join('')}</ul>${open.length > list.length ? `<p class="dcard__more">${open.length - list.length} more open</p>` : ''}`
          : empty('inbox', 'No enquiries need follow-up', 'New enquiries from families will appear here.');
        return `<div class="dcard">${cardHead('Enquiry follow-ups', 'Soonest first', pageUrl('admissions', { status: 'open' }), 'All enquiries')}${body}</div>`;
      }
    },
    {
      id: 'incident-list', name: 'Incidents needing attention', module: 'safeguarding', group: 'list', size: 'half',
      render() {
        const open = store.getIncidents().filter(i => i.status === 'open').sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
        const list = open.slice(0, 4);
        const body = list.length ? `<ul class="dlist">${list.map(i => {
          const s = store.studentById(i.studentId);
          return `<li class="dlist__item"><span class="avatar avatar--sm ${i.severity === 'High' ? '' : 'avatar--accent'}" aria-hidden="true">${icon('alert-triangle', 'icon--sm')}</span>
            <div class="dlist__main"><p class="dlist__title">${esc(s?.name || 'Unknown child')} <span class="dlist__muted">· ${esc(i.type)}</span></p><p class="dlist__sub">${esc(dayLabel(i.occurredAt))} ${esc(time(i.occurredAt))} · ${i.parentInformed ? 'Parent told' : '<strong class="text-warning">Parent not told</strong>'}</p></div>
            <span class="badge ${i.severity === 'High' ? 'badge--error badge--absent' : i.severity === 'Medium' ? 'badge--warning badge--late' : ''}">${esc(i.severity)}</span></li>`;
        }).join('')}</ul>${open.length > list.length ? `<p class="dcard__more">${open.length - list.length} more open</p>` : ''}`
          : empty('shield-check', 'No incidents today', 'Nothing is waiting for follow-up.');
        return `<div class="dcard">${cardHead('Incidents needing attention', 'Open, newest first', pageUrl('safeguarding', { status: 'open' }), 'All incidents')}${body}</div>`;
      }
    },
    {
      id: 'announcements', name: 'Latest announcements', module: 'communication', group: 'list', size: 'half',
      render() {
        const list = store.getAnnouncements().slice(0, 3);
        const body = list.length ? `<ul class="dlist">${list.map(a => `<li class="dlist__item"><span class="avatar avatar--sm avatar--neutral" aria-hidden="true">${icon('megaphone', 'icon--sm')}</span>
          <div class="dlist__main"><p class="dlist__title">${esc(a.title)}</p><p class="dlist__sub">${esc(a.audience)} · ${esc(a.createdBy)} · ${esc(dayLabel(a.createdAt))}</p></div></li>`).join('')}</ul>`
          : empty('megaphone', 'No announcements yet', 'Announcements to families and staff will appear here.');
        return `<div class="dcard">${cardHead('Latest announcements', '', pageUrl('communication'), 'All messages')}${body}</div>`;
      }
    }
  ];

  const QUICK = ['attendance', 'enquiry', 'payment', 'incident', 'announcement'];

  /* ------------------------------------------------------------ Visibility (role → plan → preference) */

  function widgetStates(user) {
    const prefs = store.getDashboardPrefs(user);
    return WIDGETS
      .filter(w => store.canAccess(user, w.module) && (!w.when || w.when(user)))
      .map(w => {
        const locked = !store.isEntitled(w.module);
        return { w, locked, shown: !locked && (w.mandatory || !prefs.hidden.includes(w.id)) };
      });
  }
  // Modules the role may open but the plan doesn't include: one locked card each, never their data.
  const lockedModules = user => [...new Set(widgetStates(user).filter(s => s.locked).map(s => s.w.module))];

  /* ------------------------------------------------------------ Page frame */

  function greeting(date = new Date()) {
    const h = date.getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  function schoolStatus() {
    const s = store.getSettings(store.school.id);
    const { open, close, days } = s.hours;
    if (!open || !close) return { tone: 'neutral', text: 'School hours not set' };
    const fmt = t => {
      if (s.preferences.timeFormat === '24h') return t;
      const [h, m] = t.split(':').map(Number);
      return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
    };
    const now = new Date();
    const key = store.WEEKDAYS[(now.getDay() + 6) % 7];
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const range = `${fmt(open)}–${fmt(close)}`;
    if (!days.includes(key)) return { tone: 'neutral', text: `Closed today · ${range} on school days` };
    if (hm < open) return { tone: 'neutral', text: `Opens at ${fmt(open)} · ${range}` };
    if (hm >= close) return { tone: 'neutral', text: `Closed · ${range}` };
    return { tone: 'open', text: `Open · ${range}` };
  }

  function headerHtml(user) {
    const status = schoolStatus();
    return `
      <div class="dash-head__text">
        <p class="dash-head__date"><time datetime="${store.today()}">${esc(new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</time></p>
        <h1 class="dash-head__greet" id="dash-title" tabindex="-1">${esc(greeting())}, ${esc(user.name)}</h1>
        <div class="dash-head__chips">
          <span class="dash-chip dash-chip--${status.tone}">${status.tone === 'open' ? '<span class="dash-chip__dot" aria-hidden="true"></span>' : icon('clock', 'icon--sm')}${esc(status.text)}</span>
          <span class="dash-chip">${icon('user', 'icon--sm')}${esc(user.role)} · ${esc(store.school.name)}</span>
        </div>
      </div>`;
  }

  function broadcastsHtml(user) {
    return store.unacknowledgedFor(user).map(b => `
      <section class="sos" role="alert" aria-labelledby="sos-${esc(b.id)}" data-broadcast="${esc(b.id)}">
        <span class="sos__icon" aria-hidden="true">${icon('siren')}</span>
        <div class="sos__body">
          <p class="sos__label" id="sos-${esc(b.id)}">Emergency broadcast</p>
          <p class="sos__msg">${esc(b.message)}</p>
          <p class="sos__meta">From ${esc(b.createdByName)} · <time datetime="${esc(b.createdAt)}">${esc(dayLabel(b.createdAt))} at ${esc(time(b.createdAt))}</time></p>
        </div>
        <button class="btn sos__ack" type="button" data-ack="${esc(b.id)}">${icon('check', 'icon--sm')}Acknowledge</button>
      </section>`).join('');
  }

  // Critical warnings: full width, never hideable. Today: class ratio breaches.
  function alertsHtml(user) {
    if (!store.canAccess(user, 'attendance') || !store.isEntitled('attendance')) return '';
    return store.ratioStatus(user).filter(r => r.status === 'breach').map(r => `
      <div class="crit">
        ${icon('alert-triangle', 'crit__icon')}
        <p class="crit__text"><strong>${esc(r.cls)} is over its ratio.</strong> ${plural(r.children, 'child', 'children')} with ${plural(r.educators, 'educator')} on duty; the limit is ${r.limit} per educator.</p>
        <a class="btn btn--secondary btn--sm crit__go" href="${pageUrl('attendance', { view: 'ratio', cls: r.cls })}">Review staffing${icon('arrow-right', 'icon--sm')}</a>
      </div>`).join('');
  }

  function quickHtml(user) {
    const kinds = QUICK.filter(k => flows.available(k, user));
    if (!kinds.length) return `<div class="qa qa--empty">${icon('info', 'icon--muted')}<p>No quick actions for ${esc(user.role)}s on the ${esc(store.currentPlan().name)} plan. Your pages are in the menu.</p></div>`;
    return `
      <div class="qa">
        <h2 class="qa__title" id="qa-title">Quick actions</h2>
        <ul class="qa__list" aria-labelledby="qa-title">
          ${kinds.map(k => { const m = flows.meta(k); return `<li><button class="qa__btn" type="button" data-flow="${k}" aria-haspopup="dialog">${icon(m.icon, 'icon--sm')}${esc(m.label)}</button></li>`; }).join('')}
        </ul>
      </div>`;
  }

  function lockedHtml(user, key) {
    const page = store.pageByKey(key);
    const plan = store.requiredPlanFor(key);
    const asked = store.findUpgradeRequest(user, key);
    const action = store.canManagePlan(user)
      ? `<a class="btn btn--secondary btn--sm" href="${routes.plans({ plan: plan.id, module: key })}">See plans${icon('arrow-right', 'icon--sm')}</a>`
      : asked ? `<span class="locked__sent">${icon('check', 'icon--sm')}Upgrade requested</span>`
        : `<button class="btn btn--secondary btn--sm" type="button" data-ask="${esc(key)}">Ask my admin</button>`;
    return `
      <div class="locked">
        <span class="locked__top"><span class="state-icon state-icon--lock" aria-hidden="true">${icon('lock')}</span><span class="badge badge--plain">${esc(plan.name)} plan</span></span>
        <p class="locked__title">${esc(page.name)}</p>
        <p class="locked__text">Not in your ${esc(store.currentPlan().name)} plan, so its figures aren’t shown here.</p>
        ${action}
      </div>`;
  }

  /* ------------------------------------------------------------ Rendering (keyed, diffed) */

  const cache = new Map();
  let intro = true;
  let lastBreaches = null;
  let user = store.currentUser();

  function safeRender(w) {
    try {
      if (failOnce.has(w.id)) { failOnce.delete(w.id); throw new Error(`Simulated failure for ${w.id}`); }
      return w.render(user);
    } catch (err) {
      console.error(err);
      return `<div class="dcard dcard--error" role="group" aria-label="${esc(w.name)}"><span class="state-icon state-icon--error" aria-hidden="true">${icon('alert-circle')}</span><p class="dcard__empty-title">${esc(w.name)} couldn’t load</p><p class="dcard__empty-text">The rest of your dashboard is fine.</p><button class="btn btn--secondary btn--sm" type="button" data-retry="${esc(w.id)}">${icon('refresh', 'icon--sm')}Try again</button></div>`;
    }
  }

  function items() {
    const list = [{ id: 'quick-actions', group: 'actions', size: 'full', html: quickHtml(user) }];
    const states = widgetStates(user);
    const lockedKeys = lockedModules(user);
    states.filter(s => s.shown && s.w.size === 'kpi').forEach(s => list.push({ id: s.w.id, group: s.w.group, size: s.w.size, html: safeRender(s.w), label: s.w.name }));
    lockedKeys.forEach(k => list.push({ id: `locked-${k}`, group: 'kpi', size: 'kpi', html: lockedHtml(user, k), label: `${store.pageByKey(k).name} (locked)` }));
    states.filter(s => s.shown && s.w.size !== 'kpi').forEach(s => list.push({ id: s.w.id, group: s.w.group, size: s.w.size, html: safeRender(s.w), label: s.w.name }));
    return list;
  }

  function frame() {
    main.innerHTML = `
      <div class="dash__wrap">
        <div class="dash__sos" data-sos></div>
        <header class="dash-head"><div data-head></div><div class="dash-head__tools" data-tools><button class="btn btn--ghost btn--sm" type="button" data-customise aria-haspopup="dialog">${icon('sliders', 'icon--sm')}Customise</button></div></header>
        <div class="dash__alerts" data-alerts></div>
        <section class="dash-grid" aria-labelledby="dash-grid-title" data-grid><h2 class="sr-only" id="dash-grid-title">Today at a glance</h2></section>
        <p class="sr-only" aria-live="polite" data-live></p>
      </div>
      <div class="dash-tip" role="tooltip" id="dash-tip" hidden></div>`;
  }

  const setHtml = (el, html) => { if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html; } };

  function render() {
    user = store.currentUser();
    const sos = main.querySelector('[data-sos]');
    const focusInSos = sos.contains(document.activeElement);
    setHtml(sos, broadcastsHtml(user));
    if (focusInSos && !sos.contains(document.activeElement)) (sos.querySelector('[data-ack]') || main.querySelector('#dash-title'))?.focus();
    setHtml(main.querySelector('[data-head]'), headerHtml(user));
    setHtml(main.querySelector('[data-alerts]'), alertsHtml(user));
    // The shared bell shows a red dot while a class in scope is over ratio.
    const over = store.canAccess(user, 'attendance') && store.isEntitled('attendance') ? store.ratioStatus(user).filter(r => r.status === 'breach').length : 0;
    window.NexoraBell.setAlert(over ? `${plural(over, 'class', 'classes')} over ratio` : null);

    const grid = main.querySelector('[data-grid]');
    const next = items();
    const keep = new Set(next.map(i => i.id));
    // Leaving widgets fade out; reduced motion removes them at once.
    grid.querySelectorAll('[data-widget]').forEach(el => {
      if (keep.has(el.dataset.widget) || el.classList.contains('is-leaving')) return;
      cache.delete(el.dataset.widget);
      if (reduceMotion.matches || intro) { el.remove(); return; }
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 200);
    });
    let prev = grid.querySelector('h2');
    next.forEach((item, i) => {
      let el = grid.querySelector(`[data-widget="${item.id}"]`);
      if (!el) {
        el = document.createElement(item.id === 'quick-actions' ? 'div' : 'article');
        el.dataset.widget = item.id;
        if (item.label) el.setAttribute('aria-label', item.label);
        el.className = `dash-item dash-item--${item.size} dash-item--${item.group}${intro ? ' is-intro' : ' is-entering'}`;
        el.style.setProperty('--i', i);
        if (!intro) el.addEventListener('animationend', () => el.classList.remove('is-entering'), { once: true });
      }
      if (cache.get(item.id) !== item.html) { el.innerHTML = item.html; cache.set(item.id, item.html); }
      if (prev.nextElementSibling !== el) prev.after(el);
      prev = el;
    });
    intro = false;
    announceBreaches();
  }

  function announceBreaches() {
    const now = store.canAccess(user, 'attendance') && store.isEntitled('attendance') ? store.ratioStatus(user).filter(r => r.status === 'breach').map(r => r.cls).sort().join(', ') : '';
    if (lastBreaches !== null && now !== lastBreaches) {
      main.querySelector('[data-live]').textContent = now ? `Ratio warning: ${now} over ratio.` : 'All classes are within ratio.';
    }
    lastBreaches = now;
  }

  function skeleton() {
    const kpis = Array.from({ length: 4 }, () => `<div class="dash-item dash-item--kpi"><div class="kpi kpi--skeleton"><span class="skeleton sk-line w-60"></span><span class="skeleton sk-title"></span><span class="skeleton sk-line w-80"></span></div></div>`).join('');
    const halves = Array.from({ length: 2 }, () => `<div class="dash-item dash-item--half"><div class="dcard"><span class="skeleton sk-title"></span>${Array.from({ length: 4 }, () => '<div class="sk-row"><span class="skeleton sk-circle"></span><span class="sk-stack"><span class="skeleton sk-line w-70"></span><span class="skeleton sk-line w-40"></span></span></div>').join('')}</div></div>`).join('');
    main.innerHTML = `
      <div class="dash__wrap" aria-busy="true">
        <div class="dash-head"><div class="dash-head__text"><span class="skeleton sk-line w-40"></span><span class="skeleton dash-sk-greet"></span><span class="skeleton sk-line w-60"></span></div></div>
        <div class="dash-grid"><div class="dash-item dash-item--full"><span class="skeleton dash-sk-qa"></span></div>${kpis}${halves}</div>
        <p class="sr-only" role="status">Loading your dashboard…</p>
      </div>`;
  }

  /* ------------------------------------------------------------ Customise (per user) */

  function openCustomise() {
    const opener = document.activeElement;
    const states = widgetStates(user);
    const prefs = store.getDashboardPrefs(user);
    const row = s => {
      const id = `cw-${s.w.id}`;
      if (s.locked) return `<li class="cust__row is-locked"><label class="check" for="${id}"><input type="checkbox" id="${id}" disabled aria-describedby="${id}-why">${esc(s.w.name)}</label><span class="cust__why" id="${id}-why">${icon('lock', 'icon--sm')}Needs ${esc(store.requiredPlanFor(s.w.module).name)} plan</span></li>`;
      if (s.w.mandatory) return `<li class="cust__row"><label class="check" for="${id}"><input type="checkbox" id="${id}" checked disabled aria-describedby="${id}-why">${esc(s.w.name)}</label><span class="cust__why" id="${id}-why">${icon('shield-check', 'icon--sm')}Always shown for safety</span></li>`;
      return `<li class="cust__row"><label class="check" for="${id}"><input type="checkbox" id="${id}" value="${esc(s.w.id)}" data-pick${prefs.hidden.includes(s.w.id) ? '' : ' checked'}>${esc(s.w.name)}</label></li>`;
    };
    const dialog = document.createElement('dialog');
    dialog.className = 'modal';
    dialog.setAttribute('aria-labelledby', 'cust-title');
    dialog.innerHTML = `
      <form class="modal__panel" method="dialog" novalidate>
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top"><span class="tech-label">Dashboard / Customise</span><button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button></div>
        <div class="modal__body">
          <h2 class="modal__title" id="cust-title">Customise your dashboard</h2>
          <p class="modal__desc">Choose what you see. Saved for ${esc(user.name)} only. Emergency alerts and ratio warnings always show.</p>
          ${states.length ? `<ul class="cust">${states.map(row).join('')}</ul>` : '<p class="modal__desc">There are no widgets for your role yet.</p>'}
          <button class="btn btn--tertiary btn--sm cust__reset" type="button" data-reset>${icon('refresh', 'icon--sm')}Reset to default</button>
        </div>
        <div class="modal__foot"><button class="btn btn--primary" type="submit">Apply</button><button class="btn btn--secondary" type="button" data-close>Cancel</button></div>
      </form>`;
    document.body.appendChild(dialog);
    const close = () => {
      if (dialog.classList.contains('is-closing')) return;
      dialog.classList.add('is-closing');
      const done = () => { dialog.close(); dialog.remove(); if (document.contains(opener)) opener.focus(); else main.querySelector('[data-customise]')?.focus(); };
      reduceMotion.matches ? done() : setTimeout(done, 170);
    };
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.addEventListener('click', e => {
      if (e.target === dialog || e.target.closest('[data-close]')) close();
      if (e.target.closest('[data-reset]')) dialog.querySelectorAll('[data-pick]').forEach(c => { c.checked = true; });
    });
    dialog.querySelector('form').addEventListener('submit', e => {
      e.preventDefault();
      const unchecked = [...dialog.querySelectorAll('[data-pick]')].filter(c => !c.checked).map(c => c.value);
      // Keep preferences for widgets this role can't see right now (another plan or role later).
      const visibleIds = new Set(states.map(s => s.w.id));
      const hidden = [...prefs.hidden.filter(id => !visibleIds.has(id)), ...unchecked];
      if (!store.saveDashboardPrefs(user, { hidden })) { window.NexoraToast.show('Couldn’t save your layout', 'Storage is blocked in this browser. Please try again.', 'info'); return; }
      close();
      window.NexoraToast.show('Dashboard updated', 'Your layout is saved for next time.');
    });
    dialog.showModal();
    (dialog.querySelector('[data-pick]') || dialog.querySelector('[type="submit"]')).focus();
  }

  /* ------------------------------------------------------------ Events */

  function bind() {
    main.addEventListener('click', async e => {
      const flow = e.target.closest('[data-flow]');
      if (flow) { flows.open(flow.dataset.flow); return; }
      const ack = e.target.closest('[data-ack]');
      if (ack) {
        if (!store.acknowledgeBroadcast(user, ack.dataset.ack)) window.NexoraToast.show('Not saved', 'We couldn’t save your acknowledgement. Please try again.', 'info');
        return;
      }
      const retry = e.target.closest('[data-retry]');
      if (retry) { cache.delete(retry.dataset.retry); render(); main.querySelector(`[data-widget="${retry.dataset.retry}"] a, [data-widget="${retry.dataset.retry}"] button`)?.focus(); return; }
      if (e.target.closest('[data-customise]')) { openCustomise(); return; }
      const ask = e.target.closest('[data-ask]');
      if (ask && !ask.disabled) {
        ask.disabled = true;
        const r = await store.requestUpgrade(user, ask.dataset.ask);
        if (r.ok) window.NexoraToast.show('Request sent to your school admin', 'Prototype: saved in this browser and shown in the Admin’s notifications.');
        else { ask.disabled = false; window.NexoraToast.show('Request not sent', 'We couldn’t save your request. Please try again.', 'info'); }
        render();
      }
    });

    // One tooltip for every chart mark (hover and keyboard focus).
    const tip = main.querySelector('#dash-tip');
    const show = el => {
      tip.textContent = el.dataset.tip;
      tip.hidden = false;
      const r = el.getBoundingClientRect();
      const w = tip.offsetWidth;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
      tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
    };
    const hide = () => { tip.hidden = true; };
    main.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); el ? show(el) : hide(); });
    main.addEventListener('pointerleave', hide);
    main.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); el ? show(el) : hide(); });
    addEventListener('scroll', hide, { passive: true });

    // Store changes (this tab or another): batch into one render per frame.
    let queued = false;
    store.subscribe(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; render(); });
    });
    // Greeting, date and open/closed status follow the clock.
    setInterval(() => setHtml(main.querySelector('[data-head]'), headerHtml(store.currentUser())), 60000);
  }

  window.NexoraShell.mount({
    topbar: false,
    onRoleChange() {
      cache.clear();
      lastBreaches = null;
      render();
      main.querySelector('[data-live]').textContent = `Dashboard updated for ${store.currentUser().name}, ${store.currentUser().role}.`;
    }
  });

  // Initial load: the skeleton stays at least 500ms so the switch to content never flickers.
  skeleton();
  setTimeout(() => {
    frame();
    main.querySelector('[data-tools]').appendChild(window.NexoraBell.create());
    bind();
    render();
  }, 500);
})();
