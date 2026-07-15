// Freelanly Autofill — Lever content script.
// Fills the standardized Lever application form (jobs.lever.co/<company>/<id>/apply) from the
// user's Freelanly profile. AUTO-FILL ONLY: the user reviews and clicks Submit themselves.
// Unknown/unanswerable fields get highlighted for manual entry.

(function () {
  'use strict';

  // Only act on pages that actually contain the application form.
  function findForm() {
    return document.querySelector('input[name="name"], input[name="email"]')
      ? (document.querySelector('form#application-form') || document.querySelector('form[action*="apply"]') || document.body)
      : null;
  }

  function setValue(el, value) {
    if (!el || !value) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value); // native setter — works with React-controlled inputs too
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function mark(el, kind) {
    el.classList.add(kind === 'ok' ? 'fx-filled' : 'fx-needs-you');
  }

  function toast(text, ms = 6000) {
    let t = document.getElementById('fx-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'fx-toast';
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('fx-show');
    setTimeout(() => t.classList.remove('fx-show'), ms);
  }

  function send(msg) {
    return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
  }

  async function attachResume(profile) {
    const fileInput = document.querySelector('input[type="file"][name="resume"], input[type="file"]#resume-upload-input, input[type="file"]');
    if (!fileInput || !profile.resumeUrl) return false;
    const res = await send({ type: 'resume', url: profile.resumeUrl });
    if (!res || res.error || !res.base64) return false;
    const bin = atob(res.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const file = new File([bytes], profile.resumeFileName || 'resume.pdf', { type: res.contentType });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    mark(fileInput, 'ok');
    return true;
  }

  // Lever custom question cards: name="cards[<uuid>][fieldN]". Answer text ones with AI from the
  // profile; anything we can't answer gets highlighted for the human.

  // Sensitive questions are never AI-guessed. Demographics CAN be filled from the user's own
  // one-time declarations (popup → stored in chrome.storage ONLY, never sent to the server);
  // consents/legal declarations are ALWAYS the human's.
  const SENSITIVE = /pronoun|gender|lgbt|race|ethnic|color\/|self-declare|disabilit|veteran|consent|i declare|agree to|terms of|privacy|autorizo|concordo|declaro|acknowledg|criminal|background check/i;
  const CONSENT = /consent|i declare|agree to|terms of|privacy|autorizo|concordo|declaro|acknowledg|criminal|background check|lgbt|pronoun/i;

  function demoKind(label) {
    if (/gender|\bsex\b/i.test(label)) return 'gender';
    if (/race|ethnic|color/i.test(label)) return 'race';
    if (/disabilit/i.test(label)) return 'disability';
    if (/veteran|military/i.test(label)) return 'veteran';
    return null;
  }

  const DEMO_SYNONYMS = {
    gender: { Male: /^male\b|^man\b|masculin/i, Female: /^female\b|^woman\b|feminin/i, 'Non-binary': /non.?binary|não.?binár/i },
    disability: { No: /^no\b|^não\b|do not have/i, Yes: /^yes\b|^sim\b/i },
    veteran: { No: /^no\b|not a protected veteran|não/i, Yes: /^yes\b|identify as.*veteran|^sim\b/i },
  };

  // Normalize a captured answer to a canonical value so it transfers across forms and languages
  // ("Masculino" learned on a PT form → fills "Male" on the next EN form).
  function canonicalizeDemo(kind, text) {
    if (/prefer not|decline|don.?t wish|rather not|prefiro não/i.test(text)) return 'Prefer not to say';
    if (kind === 'gender') {
      if (/^male\b|^man\b|masculin/i.test(text)) return 'Male';
      if (/^female\b|^woman\b|feminin/i.test(text)) return 'Female';
      if (/non.?binary|não.?binár/i.test(text)) return 'Non-binary';
    }
    if (kind === 'disability' || kind === 'veteran') {
      if (/^no\b|^não\b|not a protected|do not have/i.test(text)) return 'No';
      if (/^yes\b|^sim\b|identify as/i.test(text)) return 'Yes';
    }
    return text; // race etc. — store as-is; contains-match handles reuse
  }

  // LEARN from the user's own manual picks: when the human selects a demographic value in a real
  // form (isTrusted event — our programmatic fills are not trusted), remember it locally and reuse
  // it on every next form. The declaration stays the user's own; it just stops repeating.
  function captureDemographics() {
    document.addEventListener('change', (e) => {
      if (!e.isTrusted) return;
      const el = e.target;
      let value = '';
      if (el instanceof HTMLSelectElement) value = (el.selectedOptions[0]?.text || '').trim();
      else if (el instanceof HTMLInputElement && el.type === 'radio' && el.checked) value = ((el.closest('label') || el.parentElement)?.textContent || '').trim();
      else return;
      if (!value || /^select\b|^choose\b|^--/i.test(value)) return;
      const { label } = questionLabel(el);
      if (!label || CONSENT.test(label)) return;
      const kind = demoKind(label);
      if (!kind) return;
      chrome.storage.sync.get('demo').then(({ demo }) => {
        chrome.storage.sync.set({ demo: { ...(demo || {}), [kind]: canonicalizeDemo(kind, value) } });
      });
    }, true);
  }

  // Match the user's stored demographic value to one of the form's options.
  function demoMatch(kind, value, options) {
    const n = (s) => s.toLowerCase().trim();
    if (/prefer not/i.test(value)) return options.find((o) => /prefer not|decline|don.?t wish|rather not|prefiro não/i.test(o)) || null;
    const exact = options.find((o) => n(o) === n(value)) || options.find((o) => n(o).includes(n(value)) || n(value).includes(n(o)));
    if (exact) return exact;
    const syn = DEMO_SYNONYMS[kind] && DEMO_SYNONYMS[kind][value];
    return syn ? options.find((o) => syn.test(o)) || null : null;
  }

  function questionLabel(el) {
    const card = el.closest('.application-question, li, .custom-question, fieldset');
    if (!card) return { card: null, label: '' };
    const label = (card.querySelector('.application-label, .text, label, legend')?.textContent || '').trim();
    return { card, label };
  }

  // Text inputs + textareas in custom cards → free-text AI answer from the profile.
  async function fillTextQuestions(jobContext) {
    const inputs = Array.from(document.querySelectorAll('input[name^="cards["], textarea[name^="cards["]'))
      .filter((el) => el.tagName !== 'SELECT' && el.type !== 'radio' && el.type !== 'checkbox' && el.type !== 'file');
    let ai = 0, manual = 0;
    for (const el of inputs) {
      if (el.value) continue; // don't overwrite anything the user typed
      const { card, label } = questionLabel(el);
      if (!label || SENSITIVE.test(label)) { manual++; mark(card || el, 'needs'); continue; }
      const res = await send({ type: 'answer', question: label, jobContext });
      if (res && res.answer) { setValue(el, res.answer); mark(el, 'ok'); ai++; }
      else { manual++; mark(card || el, 'needs'); }
    }
    return { ai, manual };
  }

  function setSelect(el, optionText) {
    const pick = Array.from(el.options).find((o) => o.text.trim() === optionText);
    if (!pick) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(el, pick.value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Dropdowns → multiple-choice AI (or local demographics): pick ONE existing option, never invent.
  async function fillSelects(jobContext, demo) {
    const selects = Array.from(document.querySelectorAll('select')).filter((el) => !el.value);
    let ai = 0, manual = 0;
    for (const el of selects) {
      const { card, label } = questionLabel(el);
      const options = Array.from(el.options).map((o) => o.text.trim()).filter((t) => t && !/^select\b|^choose\b|^--/i.test(t));
      if (!label || options.length === 0) { manual++; mark(card || el, 'needs'); continue; }
      if (SENSITIVE.test(label)) {
        // Demographics: fill from the user's OWN declaration (local only). Consent/legal: never.
        const kind = CONSENT.test(label) ? null : demoKind(label);
        const stored = kind && demo && demo[kind];
        const hit = stored ? demoMatch(kind, stored, options) : null;
        if (hit && setSelect(el, hit)) { mark(el, 'ok'); ai++; } else { manual++; mark(card || el, 'needs'); }
        continue;
      }
      const res = await send({ type: 'answer', question: label, options, jobContext });
      if (res && res.answer && setSelect(el, res.answer)) { mark(el, 'ok'); ai++; }
      else { manual++; mark(card || el, 'needs'); }
    }
    return { ai, manual };
  }

  // Radio groups → same logic; click the winning radio.
  async function fillRadios(jobContext, demo) {
    const groups = new Map();
    document.querySelectorAll('input[type="radio"]').forEach((r) => {
      if (!r.name) return;
      if (!groups.has(r.name)) groups.set(r.name, []);
      groups.get(r.name).push(r);
    });
    let ai = 0, manual = 0;
    for (const radios of groups.values()) {
      if (radios.some((r) => r.checked)) continue;
      const { card, label } = questionLabel(radios[0]);
      const optionText = (r) => ((r.closest('label') || r.parentElement)?.textContent || '').trim();
      const options = radios.map(optionText).filter(Boolean);
      if (!label || options.length < 2) { manual++; mark(card || radios[0], 'needs'); continue; }
      let winner = null;
      if (SENSITIVE.test(label)) {
        const kind = CONSENT.test(label) ? null : demoKind(label);
        const stored = kind && demo && demo[kind];
        winner = stored ? demoMatch(kind, stored, options) : null;
      } else {
        const res = await send({ type: 'answer', question: label, options, jobContext });
        winner = res && res.answer ? options.find((t) => t === res.answer) || null : null;
      }
      const idx = winner ? options.indexOf(winner) : -1;
      if (idx >= 0) { radios[idx].click(); mark(radios[idx].closest('label') || radios[idx], 'ok'); ai++; }
      else { manual++; mark(card || radios[0], 'needs'); }
    }
    return { ai, manual };
  }

  async function fillCustomQuestions(jobContext) {
    const { demo } = await chrome.storage.sync.get('demo');
    const t = await fillTextQuestions(jobContext);
    const s = await fillSelects(jobContext, demo);
    const r = await fillRadios(jobContext, demo);
    return { ai: t.ai + s.ai + r.ai, manual: t.manual + s.manual + r.manual };
  }

  async function autofill() {
    const btn = document.getElementById('fx-fill-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Filling…'; }

    const res = await send({ type: 'profile' });
    if (!res || res.error === 'no_token' || res.error === 'invalid_token') {
      toast('Connect the extension first: click the Freelanly icon in your toolbar and paste your token.');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Autofill with Freelanly'; }
      return;
    }
    // Free for all while we grow adoption (owner 2026-07-15). Server still returns `pro` so a
    // future re-gate is just a server change — no extension update needed.
    if (!res.profile) {
      toast('Could not load your profile — log in at freelanly.com and try again.');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Autofill with Freelanly'; }
      return;
    }

    const p = res.profile;
    let filled = 0;

    const std = [
      ['input[name="name"]', p.fullName],
      ['input[name="email"]', p.email],
      ['input[name="phone"]', p.phone],
      ['input[name="org"]', p.currentCompany],
      ['input[name="urls[LinkedIn]"]', p.linkedinUrl],
      ['input[name="urls[GitHub]"]', p.githubUrl],
      ['input[name="urls[Github]"]', p.githubUrl],
      ['input[name="urls[Portfolio]"]', p.portfolioUrl],
      ['input[name="urls[Other]"]', p.portfolioUrl],
      ['input[name="location"]', p.location],
    ];
    for (const [sel, val] of std) {
      const el = document.querySelector(sel);
      if (el && !el.value && setValue(el, val)) { mark(el, 'ok'); filled++; }
    }

    const resumeOk = await attachResume(p);
    if (resumeOk) filled++;

    const jobContext = `${document.title} — ${(document.querySelector('.posting-headline h2, h2')?.textContent || '').trim()}`;
    const q = await fillCustomQuestions(jobContext);

    // Anything still empty and required → highlight.
    document.querySelectorAll('input[required], textarea[required], select[required]').forEach((el) => {
      if (!el.value && el.type !== 'hidden') mark(el.closest('.application-question') || el, 'needs');
    });

    toast(`Filled ${filled + q.ai} fields (${q.ai} AI answers)${q.manual ? ` — ${q.manual} highlighted for you` : ''}. Review everything, then click Submit yourself.`, 9000);
    const firstNeed = document.querySelector('.fx-needs-you');
    if (firstNeed) firstNeed.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (btn) { btn.disabled = false; btn.textContent = '✓ Filled — review & submit'; }
  }

  function injectButton() {
    if (document.getElementById('fx-fill-btn') || !findForm()) return;
    const btn = document.createElement('button');
    btn.id = 'fx-fill-btn';
    btn.type = 'button';
    btn.textContent = '⚡ Autofill with Freelanly';
    btn.addEventListener('click', autofill);
    document.body.appendChild(btn);
  }

  injectButton();
  captureDemographics();
  // Lever pages are static, but the apply form can render after load on some templates.
  const obs = new MutationObserver(() => injectButton());
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 15000);
})();
