/* Shared record workflows: NexoraWorkflows.open(kind, { preset }) → Promise<result | null>.
   One modal per action, used by the module's own page and by the dashboard quick actions, so the
   fields, validation, save and success message are identical wherever the action starts.
   kind: 'attendance' | 'enquiry' | 'payment' | 'incident' | 'announcement' | 'broadcast'.
   NexoraWorkflows.available(kind, user) says whether the role and plan allow it. */
(() => {
  'use strict';

  const store = window.NexoraStore;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const money = n => `₹${Number(n).toLocaleString('en-IN')}`;
  const localDateTime = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const can = (user, key) => store.canAccess(user, key) && store.isEntitled(key);

  const option = (value, label, selected) => `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
  const errorHint = name => `<p class="field__hint field__hint--error" id="wf-${name}-error" hidden></p>`;
  function field(name, label, control, { required = false, hint = '' } = {}) {
    return `
      <div class="field" data-field="${name}">
        <label class="field__label" for="wf-${name}">${esc(label)}${required ? ' <span class="field__req" aria-hidden="true">*</span><span class="sr-only">(required)</span>' : ''}</label>
        ${control}
        ${hint ? `<p class="field__hint" id="wf-${name}-hint">${esc(hint)}</p>` : ''}
        ${errorHint(name)}
      </div>`;
  }
  const described = (name, hint) => `aria-describedby="${hint ? `wf-${name}-hint ` : ''}wf-${name}-error"`;
  const input = (name, attrs = '', hint = false) => `<input class="input" id="wf-${name}" name="${name}" ${described(name, hint)} ${attrs}>`;
  const select = (name, options, attrs = '') => `<select class="input" id="wf-${name}" name="${name}" ${described(name)} ${attrs}>${options}</select>`;
  const textarea = (name, attrs = '', value = '') => `<textarea class="input" id="wf-${name}" name="${name}" ${described(name)} ${attrs}>${esc(value)}</textarea>`;

  /* ------------------------------------------------------------ Workflow definitions
     body(user, preset) → form HTML · init(form, user) · validate(form) → { field: message }
     submit(user, form) → store promise · done(result) → toast copy */

  const WORKFLOWS = {
    attendance: {
      module: 'attendance', label: 'Mark attendance', icon: 'calendar-check', title: 'Mark attendance', wide: true,
      desc: 'Choose a class, then mark each child. Late children count as on site.',
      allowed: user => can(user, 'attendance') && store.classScope(user).length > 0,
      body(user, preset) {
        const scope = store.classScope(user);
        const reg = store.getRegister();
        const first = preset.cls && scope.includes(preset.cls) ? preset.cls : (scope.find(c => !reg[c]) || scope[0]);
        return `
          ${field('cls', 'Class', select('cls', scope.map(c => option(c, `${c}${reg[c] ? ' · taken' : ' · not taken yet'}`, c === first)).join('')), { required: true })}
          <div class="wf-register" data-register></div>
          ${errorHint('marks')}`;
      },
      init(form) {
        const box = form.querySelector('[data-register]');
        const draw = () => {
          const cls = form.elements.cls.value;
          const pupils = store.roster.filter(s => s.cls === cls);
          const existing = store.getRegister()[cls]?.marks || {};
          box.innerHTML = `
            <div class="wf-register__bar">
              <p class="wf-register__count" data-count aria-live="polite"></p>
              <button class="btn btn--secondary btn--sm" type="button" data-all-present>${icon('check', 'icon--sm')}Mark all present</button>
            </div>
            <ul class="wf-register__list">
              ${pupils.map(s => `
                <li class="wf-mark">
                  <fieldset class="wf-mark__set">
                    <legend class="wf-mark__name">${esc(s.name)}</legend>
                    <div class="wf-mark__opts">
                      ${[['present', 'Present'], ['late', 'Late'], ['absent', 'Absent']].map(([v, l]) => `
                        <label class="wf-mark__opt wf-mark__opt--${v}"><input type="radio" name="mark-${s.id}" value="${v}"${existing[s.id] === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}
                    </div>
                  </fieldset>
                </li>`).join('')}
            </ul>`;
          count();
        };
        const count = () => {
          const cls = form.elements.cls.value;
          const pupils = store.roster.filter(s => s.cls === cls);
          const marked = pupils.filter(s => form.querySelector(`[name="mark-${s.id}"]:checked`)).length;
          box.querySelector('[data-count]').textContent = `${marked} of ${pupils.length} marked`;
        };
        form.elements.cls.addEventListener('change', draw);
        box.addEventListener('change', count);
        box.addEventListener('click', e => {
          if (!e.target.closest('[data-all-present]')) return;
          box.querySelectorAll('input[value="present"]').forEach(r => { if (!box.querySelector(`[name="${r.name}"]:checked`)) r.checked = true; });
          count();
        });
        draw();
      },
      validate(form) {
        const pupils = store.roster.filter(s => s.cls === form.elements.cls.value);
        const missing = pupils.filter(s => !form.querySelector(`[name="mark-${s.id}"]:checked`));
        return missing.length ? { marks: `Mark every child before saving. ${missing.length} still to mark, starting with ${missing[0].name}.` } : {};
      },
      submit(user, form) {
        const cls = form.elements.cls.value;
        const marks = Object.fromEntries(store.roster.filter(s => s.cls === cls).map(s => [s.id, form.querySelector(`[name="mark-${s.id}"]:checked`)?.value]));
        return store.saveRegister(user, cls, marks);
      },
      done: r => ['Register saved', `${r.cls} attendance is up to date.`]
    },

    enquiry: {
      module: 'admissions', label: 'Add enquiry', icon: 'user-plus', title: 'Add enquiry',
      desc: 'Record a family’s first contact so the follow-up isn’t missed.',
      allowed: user => can(user, 'admissions'),
      body: user => `
        <div class="form-grid">
          ${field('child', 'Child’s name', input('child', 'autocomplete="off" required'), { required: true })}
          ${field('parent', 'Parent or guardian', input('parent', 'autocomplete="name" required'), { required: true })}
          ${field('phone', 'Phone', input('phone', 'type="tel" autocomplete="tel" inputmode="tel" required placeholder="+91 98400 00000"'), { required: true })}
          ${field('email', 'Email', input('email', 'type="email" autocomplete="email" placeholder="name@example.com"'))}
          ${field('programme', 'Class of interest', select('programme', option('', 'Choose a class', true) + store.CLASS_LEVELS.map(l => option(l, l)).join(''), 'required'), { required: true })}
          ${field('followUp', 'Follow up on', input('followUp', `type="date" value="${store.today()}"`))}
          ${field('assignedTo', 'Assign follow-up to', select('assignedTo', option('', 'Me', true) + store.users.filter(u => u.id !== user.id && store.canAccess(u, 'admissions')).map(u => option(u.id, `${u.name} · ${u.role}`)).join('')), { hint: 'They’ll get a mention in their notifications.' })}
          <div class="span-all">${field('notes', 'Notes', textarea('notes', 'maxlength="500" placeholder="What did the family ask about?"'))}</div>
        </div>`,
      validate(form) {
        const v = n => form.elements[n].value.trim();
        const errors = {};
        if (!v('child')) errors.child = 'Enter the child’s name.';
        if (!v('parent')) errors.parent = 'Enter the parent or guardian’s name.';
        if (v('phone').replace(/\D/g, '').length < 10) errors.phone = 'Enter a phone number with at least 10 digits.';
        if (v('email') && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email'))) errors.email = 'Enter an email address like name@example.com, or leave it empty.';
        if (!v('programme')) errors.programme = 'Choose the class the family is interested in.';
        return errors;
      },
      submit: (user, form) => store.addAdmissionEnquiry(user, Object.fromEntries(new FormData(form))),
      done: r => ['Enquiry added', `${r.enquiry.child} is in the admissions pipeline.`]
    },

    payment: {
      module: 'fees', label: 'Record payment', icon: 'wallet', title: 'Record payment',
      desc: 'Record money received against a child’s fee. Prototype: no payment is taken.',
      allowed: user => can(user, 'fees'),
      body(user, preset) {
        const due = store.feeLedger().filter(l => l.balance > 0).sort((a, b) => a.student.name.localeCompare(b.student.name));
        if (!due.length) return `<div class="wf-empty">${icon('check-circle', 'icon--success')}<p><strong>No fees outstanding</strong><br>Every invoice for ${esc(store.TERM)} is paid.</p></div>`;
        const pick = due.find(l => l.id === preset.invoiceId) || null;
        return `
          <div class="form-grid">
            <div class="span-all">${field('invoiceId', 'Child', select('invoiceId', option('', 'Choose a child with fees due', !pick) + due.map(l => option(l.id, `${l.student.name} · ${l.student.cls} · ${money(l.balance)} due`, pick === l)).join(''), 'required'), { required: true })}</div>
            ${field('amount', 'Amount received (₹)', input('amount', `type="number" min="1" step="1" inputmode="decimal" required value="${pick ? pick.balance : ''}"`, true), { required: true, hint: 'Up to the amount due.' })}
            ${field('method', 'Method', select('method', store.PAYMENT_METHODS.map((m, i) => option(m, m, i === 1)).join(''), 'required'), { required: true })}
            ${field('date', 'Date received', input('date', `type="date" required value="${store.today()}" max="${store.today()}"`), { required: true })}
            ${field('reference', 'Reference', input('reference', 'maxlength="60" placeholder="UPI or cheque number"'))}
          </div>`;
      },
      init(form) {
        const sel = form.elements.invoiceId;
        if (!sel) { form.querySelector('[type="submit"]').disabled = true; return; }
        sel.addEventListener('change', () => {
          const line = store.feeLedger().find(l => l.id === sel.value);
          if (line) form.elements.amount.value = line.balance;
        });
      },
      validate(form) {
        const errors = {};
        const line = store.feeLedger().find(l => l.id === form.elements.invoiceId.value);
        const amount = Number(form.elements.amount.value);
        if (!line) errors.invoiceId = 'Choose the child this payment is for.';
        if (!(amount > 0)) errors.amount = 'Enter the amount received.';
        else if (line && amount > line.balance) errors.amount = `That’s more than the ${money(line.balance)} due.`;
        if (!form.elements.date.value) errors.date = 'Enter the date the money was received.';
        return errors;
      },
      submit: (user, form) => store.recordPayment(user, Object.fromEntries(new FormData(form))),
      done: r => ['Payment recorded', `${money(r.payment.amount)} for ${store.studentById(r.payment.studentId).name}. ${r.balance > 0 ? `${money(r.balance)} still due.` : 'Fully paid.'}`]
    },

    incident: {
      module: 'safeguarding', label: 'Log incident', icon: 'alert-triangle', title: 'Log incident',
      desc: 'Write down what happened while it’s fresh. Leaders can follow it up from Safeguarding.',
      allowed: user => can(user, 'safeguarding'),
      body: user => {
        const scope = store.classScope(user);
        return `
          <div class="form-grid">
            <div class="span-all">${field('studentId', 'Child', select('studentId', option('', 'Choose a child', true) + scope.map(c => `<optgroup label="${esc(c)}">${store.roster.filter(s => s.cls === c).map(s => option(s.id, s.name)).join('')}</optgroup>`).join(''), 'required'), { required: true })}</div>
            ${field('type', 'Type', select('type', store.INCIDENT_TYPES.map(t => option(t, t)).join(''), 'required'), { required: true })}
            ${field('occurredAt', 'When', input('occurredAt', `type="datetime-local" required value="${localDateTime()}" max="${localDateTime()}"`), { required: true })}
            <fieldset class="field choice-group span-all" aria-describedby="wf-severity-error">
              <legend class="field__label">Severity <span class="field__req" aria-hidden="true">*</span></legend>
              <div class="pr-times__row">${store.SEVERITIES.map((s, i) => `<label class="radio"><input type="radio" name="severity" value="${s}"${i === 0 ? ' checked' : ''}>${s}</label>`).join('')}</div>
              ${errorHint('severity')}
            </fieldset>
            <div class="span-all">${field('description', 'What happened', textarea('description', 'required maxlength="1000"'), { required: true })}</div>
            <div class="span-all">${field('action', 'Action taken', textarea('action', 'maxlength="500" placeholder="First aid, who was told, next steps"'))}</div>
            <label class="check span-all"><input type="checkbox" name="parentInformed">Parent or guardian has been told</label>
          </div>`;
      },
      validate(form) {
        const errors = {};
        if (!form.elements.studentId.value) errors.studentId = 'Choose the child involved.';
        if (!form.elements.occurredAt.value) errors.occurredAt = 'Enter when it happened.';
        if (!form.elements.description.value.trim()) errors.description = 'Describe what happened.';
        return errors;
      },
      submit: (user, form) => store.logIncident(user, {
        studentId: form.elements.studentId.value, type: form.elements.type.value, severity: form.elements.severity.value,
        occurredAt: new Date(form.elements.occurredAt.value).toISOString(), description: form.elements.description.value,
        action: form.elements.action.value, parentInformed: form.elements.parentInformed.checked
      }),
      done: r => ['Incident logged', `${store.studentById(r.incident.studentId).name} · ${r.incident.type}. It’s open until a leader resolves it.`]
    },

    announcement: {
      module: 'communication', label: 'New announcement', icon: 'megaphone', title: 'New announcement',
      desc: 'Share news with families or staff. Prototype: saved here, not sent to anyone yet.',
      allowed: user => can(user, 'communication'),
      body: user => {
        const audiences = user.role === 'Teacher' ? store.classScope(user) : store.AUDIENCES;
        return `
          ${field('title', 'Title', input('title', 'required maxlength="120"'), { required: true })}
          ${field('body', 'Message', textarea('body', 'required maxlength="1000"'), { required: true })}
          ${field('audience', 'Who should see it', select('audience', audiences.map((a, i) => option(a, a, i === 0)).join(''), 'required'), { required: true })}`;
      },
      validate(form) {
        const errors = {};
        if (!form.elements.title.value.trim()) errors.title = 'Give the announcement a title.';
        if (!form.elements.body.value.trim()) errors.body = 'Write the message.';
        return errors;
      },
      submit: (user, form) => store.postAnnouncement(user, Object.fromEntries(new FormData(form))),
      done: r => ['Announcement saved', `“${r.announcement.title}” for ${r.announcement.audience}. Prototype: not sent.`]
    },

    broadcast: {
      module: 'communication', label: 'Emergency broadcast', icon: 'siren', title: 'Send emergency broadcast', danger: true,
      desc: 'Everyone at the school sees this at the top of their dashboard until they acknowledge it.',
      allowed: user => store.canBroadcast(user),
      body: () => `
        ${field('message', 'Message', textarea('message', 'required maxlength="280" placeholder="What is happening and what should staff do?"'), { required: true })}
        <label class="check"><input type="checkbox" name="confirm" aria-describedby="wf-confirm-error">I understand every staff member will see this alert</label>
        ${errorHint('confirm')}`,
      validate(form) {
        const errors = {};
        if (!form.elements.message.value.trim()) errors.message = 'Write the emergency message.';
        if (!form.elements.confirm.checked) errors.confirm = 'Confirm before sending.';
        return errors;
      },
      submit: (user, form) => store.sendBroadcast(user, form.elements.message.value),
      done: () => ['Emergency broadcast sent', 'It stays at the top of every dashboard until each person acknowledges it.']
    }
  };

  /* ------------------------------------------------------------ Modal (native <dialog>, same pattern as access-denied) */

  function setLoading(btn, label) {
    btn.dataset.original = btn.innerHTML;
    btn.style.minWidth = `${btn.offsetWidth}px`;
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('aria-disabled', 'true');
    btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(label)}`;
  }
  function clearLoading(btn) {
    btn.innerHTML = btn.dataset.original;
    btn.style.minWidth = '';
    btn.classList.remove('is-loading');
    btn.removeAttribute('aria-busy');
    btn.removeAttribute('aria-disabled');
  }

  const FAIL = {
    forbidden: 'Your role or your school’s plan doesn’t allow this. Nothing was saved.',
    storage: 'This couldn’t be saved on this device. Your details are still here. Please try again.',
    incomplete: 'Mark every child before saving.',
    invalid: 'Some details aren’t valid. Check the highlighted fields.'
  };

  let current = null;

  function open(kind, { preset = {} } = {}) {
    const wf = WORKFLOWS[kind];
    const user = store.currentUser();
    if (!wf || !wf.allowed(user)) {
      window.NexoraToast?.show('Not available', 'Your role or your school’s plan doesn’t include this action.', 'info');
      return Promise.resolve(null);
    }
    if (current) return Promise.resolve(null);
    const opener = document.activeElement;

    const dialog = document.createElement('dialog');
    dialog.className = `modal wf${wf.wide ? ' wf--wide' : ''}`;
    dialog.setAttribute('aria-labelledby', 'wf-title');
    dialog.setAttribute('aria-describedby', 'wf-desc');
    dialog.innerHTML = `
      <form class="modal__panel" novalidate>
        <span class="modal__grabber" aria-hidden="true"></span>
        <div class="modal__top">
          <span class="tech-label">${esc(store.pageByKey(wf.module).name)} / ${esc(wf.label)}</span>
          <button class="btn btn--icon-ghost" type="button" aria-label="Close" data-close>${icon('x')}</button>
        </div>
        <div class="modal__body">
          ${wf.danger ? `<span class="modal__icon" aria-hidden="true">${icon(wf.icon)}</span>` : ''}
          <h2 class="modal__title" id="wf-title">${esc(wf.title)}</h2>
          <p class="modal__desc" id="wf-desc">${esc(wf.desc)}</p>
          ${wf.body(user, preset)}
          <p class="field__hint field__hint--error" data-send-error role="alert" hidden></p>
        </div>
        <div class="modal__foot">
          <button class="btn ${wf.danger ? 'btn--danger' : 'btn--primary'}" type="submit">${wf.danger ? 'Send to everyone' : 'Save'}</button>
          <button class="btn btn--secondary" type="button" data-close>Cancel</button>
        </div>
      </form>`;
    document.body.appendChild(dialog);
    const form = dialog.querySelector('form');
    const submitBtn = form.querySelector('[type="submit"]');
    const sendError = form.querySelector('[data-send-error]');
    wf.init?.(form, user);

    let busy = false;
    let resolveOpen;
    const result = new Promise(r => { resolveOpen = r; });
    current = dialog;

    function close(value = null) {
      if (busy || dialog.classList.contains('is-closing')) return;
      dialog.classList.add('is-closing');
      const done = () => {
        dialog.close();
        dialog.remove();
        current = null;
        if (opener && document.contains(opener) && !opener.disabled) opener.focus();
        resolveOpen(value);
      };
      reduceMotion.matches ? done() : setTimeout(done, 170);
    }

    function showErrors(errors) {
      form.querySelectorAll('[id^="wf-"][id$="-error"]').forEach(el => { el.hidden = true; el.textContent = ''; });
      form.querySelectorAll('[aria-invalid="true"]').forEach(el => el.setAttribute('aria-invalid', 'false'));
      let first = null;
      Object.entries(errors).forEach(([name, message]) => {
        const hint = form.querySelector(`#wf-${name}-error`);
        if (hint) { hint.innerHTML = `${icon('info')}${esc(message)}`; hint.hidden = false; }
        const control = form.querySelector(`#wf-${name}`) || form.querySelector(`[name="${name}"]`) || form.querySelector('.wf-mark input:not(:checked)');
        control?.setAttribute('aria-invalid', 'true');
        first = first || control;
      });
      return first;
    }

    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (busy || submitBtn.disabled) return;
      sendError.hidden = true;
      const invalid = showErrors(wf.validate(form));
      if (invalid) {
        // For the register, move focus to the first unmarked child.
        const target = kind === 'attendance' ? [...form.querySelectorAll('.wf-mark')].find(li => !li.querySelector(':checked'))?.querySelector('input') : invalid;
        (target || invalid).focus();
        return;
      }
      busy = true;
      setLoading(submitBtn, 'Saving…');
      let r;
      try { r = await wf.submit(store.currentUser(), form); } catch { r = { ok: false, reason: 'storage' }; }
      busy = false;
      clearLoading(submitBtn);
      // On failure everything the user entered stays in the form.
      if (!r.ok) {
        sendError.innerHTML = `${icon('info')}${esc(FAIL[r.reason] || FAIL.storage)}`;
        sendError.hidden = false;
        submitBtn.focus();
        return;
      }
      const [title, text] = wf.done(r);
      close(r);
      window.NexoraToast?.show(title, text);
    });
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    dialog.addEventListener('click', e => { if (e.target === dialog || e.target.closest('[data-close]')) close(); });

    dialog.showModal();
    (form.querySelector('.modal__body .input, .modal__body input') || submitBtn).focus();
    return result;
  }

  const available = (kind, user = store.currentUser()) => Boolean(WORKFLOWS[kind]?.allowed(user));
  const meta = kind => { const w = WORKFLOWS[kind]; return w && { kind, label: w.label, icon: w.icon, module: w.module }; };

  window.NexoraWorkflows = { open, available, meta };
})();
