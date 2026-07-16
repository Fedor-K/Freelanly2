// Freelanly Autofill — ATS content script.
// Fills standard application forms (Lever, Greenhouse, Ashby, Workable, and other ATS) from the
// user's Freelanly profile. AUTO-FILL ONLY: the user reviews and clicks Submit themselves.
// Unknown/unanswerable fields get highlighted for manual entry.
//
// Design: instead of hardcoding one ATS's field names, we detect fields by their *label signals*
// (visible label + name + id + placeholder + autocomplete + aria-label). That makes standard-field
// detection work across ATS DOMs. Custom questions are answered by AI from the profile.

(function () {
  'use strict';

  // ---- form detection -------------------------------------------------------------------------
  // We only run on ATS apply hosts (see manifest), so a nearby email or file input is a good
  // enough signal that an application form is on the page.
  function findForm() {
    return document.querySelector('input[type="email"], input[name*="email" i], input[type="file"]')
      ? document.body
      : null;
  }

  // ---- primitives -----------------------------------------------------------------------------
  function setValue(el, value) {
    if (!el || !value) return false;
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    setter.call(el, value); // native setter — works with React-controlled inputs too
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
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

  function mark(el, kind) {
    if (el) el.classList.add(kind === 'ok' ? 'fx-filled' : 'fx-needs-you');
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

  function isVisible(el) {
    return el && !el.disabled && !el.readOnly && el.type !== 'hidden' && el.offsetParent !== null;
  }

  // ---- label extraction (ATS-agnostic) --------------------------------------------------------
  function labelText(el) {
    if (el.id) {
      try {
        const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (l && l.textContent.trim()) return l.textContent.trim();
      } catch (_) { /* bad id */ }
    }
    const wrap = el.closest('label');
    if (wrap && wrap.textContent.trim()) return wrap.textContent.trim();
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map((id) => (document.getElementById(id)?.textContent || '')).join(' ').trim();
      if (t) return t;
    }
    const card = el.closest('.application-question, .field, fieldset, [class*="field"], [class*="question"], li');
    if (card) {
      const lab = card.querySelector('.application-label, .text, label, legend, [class*="label"]');
      if (lab && lab.textContent.trim()) return lab.textContent.trim();
    }
    return (el.getAttribute('aria-label') || el.placeholder || '').trim();
  }

  function questionLabel(el) {
    const card = el.closest('.application-question, .field, fieldset, [class*="question"], li') || el.parentElement;
    return { card, label: labelText(el) };
  }

  // Full signal string used to classify standard fields.
  function fieldSignals(el) {
    return [labelText(el), el.name, el.id, el.placeholder, el.getAttribute('autocomplete'), el.getAttribute('aria-label')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[_\-\[\]]/g, ' ');
  }

  // ---- standard-field classification ----------------------------------------------------------
  // Returns a profile key for a text-like input, or null. Order matters (first/last before full,
  // linkedin/github before generic portfolio).
  function stdKind(el) {
    const type = (el.type || '').toLowerCase();
    if (type === 'email') return 'email';
    if (type === 'tel') return 'phone';
    const s = fieldSignals(el);
    if (!s) return null;

    if (/first ?name|given ?name|\bfname\b|forename/.test(s)) return 'firstName';
    if (/last ?name|surname|family ?name|\blname\b/.test(s)) return 'lastName';
    if (/linkedin/.test(s)) return 'linkedin';
    if (/github/.test(s)) return 'github';
    if (/portfolio|personal (site|website)|dribbble|behance|your (site|website)/.test(s)) return 'portfolio';
    if (/e ?mail/.test(s)) return 'email';
    if (/phone|mobile|\btel\b|cell/.test(s)) return 'phone';
    if (/current (company|employer)|\bcompany\b|organization|organisation|employer|where do you work/.test(s)) return 'company';
    if (/location|\bcity\b|current location|where are you|country|address/.test(s)) return 'location';
    if (/website|\bwebsite\b|\bwww\b/.test(s)) return 'portfolio';
    // Full name last, and only when it isn't actually a company/username field.
    if (/full ?name|your name|applicant name|^name$|\bname\b/.test(s) &&
        !/company|organization|organisation|employer|user ?name|display name|screen ?name/.test(s)) {
      return 'fullName';
    }
    return null;
  }

  function stdValue(kind, p) {
    const parts = (p.fullName || '').trim().split(/\s+/);
    switch (kind) {
      case 'fullName': return p.fullName;
      case 'firstName': return parts[0] || '';
      case 'lastName': return parts.slice(1).join(' ') || '';
      case 'email': return p.email;
      case 'phone': return p.phone;
      case 'linkedin': return p.linkedinUrl;
      case 'github': return p.githubUrl;
      case 'portfolio': return p.portfolioUrl;
      case 'company': return p.currentCompany;
      case 'location': return p.location;
      default: return '';
    }
  }

  // ---- resume ---------------------------------------------------------------------------------
  function findResumeInput() {
    const files = Array.from(document.querySelectorAll('input[type="file"]'));
    return files.find((f) => /resume|résumé|\bcv\b|curriculum/i.test(fieldSignals(f))) || files[0] || null;
  }

  async function attachResume(profile) {
    const fileInput = findResumeInput();
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

  // ---- sensitive / demographics (unchanged policy) --------------------------------------------
  // Sensitive questions are never AI-guessed. Demographics CAN be filled from the user's own
  // one-time declarations (popup / learned locally — chrome.storage ONLY, never sent to the
  // server); consents/legal declarations are ALWAYS the human's.
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
    return text;
  }

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

  function demoMatch(kind, value, options) {
    const n = (s) => s.toLowerCase().trim();
    if (/prefer not/i.test(value)) return options.find((o) => /prefer not|decline|don.?t wish|rather not|prefiro não/i.test(o)) || null;
    const exact = options.find((o) => n(o) === n(value)) || options.find((o) => n(o).includes(n(value)) || n(value).includes(n(o)));
    if (exact) return exact;
    const syn = DEMO_SYNONYMS[kind] && DEMO_SYNONYMS[kind][value];
    return syn ? options.find((o) => syn.test(o)) || null : null;
  }

  // ---- custom questions -----------------------------------------------------------------------
  // Free-text inputs/textareas that are NOT standard fields → AI free-text answer from the profile.
  async function fillTextQuestions(jobContext, consumed) {
    const inputs = Array.from(document.querySelectorAll('input, textarea')).filter((el) => {
      if (consumed.has(el) || !isVisible(el)) return false;
      const type = (el.tagName === 'TEXTAREA') ? 'textarea' : (el.type || 'text').toLowerCase();
      if (!['text', 'textarea', 'search', ''].includes(type)) return false;
      return stdKind(el) === null; // standard fields handled elsewhere
    });
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

  // Dropdowns → multiple-choice AI (or local demographics): pick ONE existing option, never invent.
  async function fillSelects(jobContext, demo, consumed) {
    const selects = Array.from(document.querySelectorAll('select')).filter((el) => isVisible(el) && !el.value && !consumed.has(el));
    let ai = 0, manual = 0;
    for (const el of selects) {
      const { card, label } = questionLabel(el);
      const options = Array.from(el.options).map((o) => o.text.trim()).filter((t) => t && !/^select\b|^choose\b|^--/i.test(t));
      if (!label || options.length === 0) { manual++; mark(card || el, 'needs'); continue; }
      if (SENSITIVE.test(label)) {
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
      if (!r.name || !isVisible(r)) return;
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

  async function fillCustomQuestions(jobContext, consumed) {
    const { demo } = await chrome.storage.sync.get('demo');
    const t = await fillTextQuestions(jobContext, consumed);
    const s = await fillSelects(jobContext, demo, consumed);
    const r = await fillRadios(jobContext, demo);
    return { ai: t.ai + s.ai + r.ai, manual: t.manual + s.manual + r.manual };
  }

  // ---- orchestration --------------------------------------------------------------------------
  async function autofill() {
    const btn = document.getElementById('fx-fill-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Filling…'; }

    const res = await send({ type: 'profile' });
    if (!res || res.error === 'no_token' || res.error === 'invalid_token') {
      toast('Connect the extension first: click the Freelanly icon in your toolbar and paste your token.');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Autofill with Freelanly'; }
      return;
    }
    if (!res.profile) {
      toast('Could not load your profile — log in at freelanly.com and try again.');
      if (btn) { btn.disabled = false; btn.textContent = '⚡ Autofill with Freelanly'; }
      return;
    }

    const p = res.profile;
    const consumed = new Set();
    let filled = 0;

    // Standard text-like fields, classified by label signals across ATS.
    const textEls = Array.from(document.querySelectorAll('input, textarea')).filter((el) => {
      if (!isVisible(el)) return false;
      const type = (el.type || 'text').toLowerCase();
      return !['file', 'checkbox', 'radio', 'submit', 'button', 'reset', 'password', 'hidden'].includes(type);
    });
    for (const el of textEls) {
      const kind = stdKind(el);
      if (!kind) continue;
      consumed.add(el); // a standard field — keep custom-question passes off it
      if (el.value) continue; // respect anything the user already typed
      const val = stdValue(kind, p);
      if (val && setValue(el, val)) { mark(el, 'ok'); filled++; }
    }

    const resumeOk = await attachResume(p);
    if (resumeOk) filled++;

    const jobContext = `${document.title} — ${(document.querySelector('h1, .posting-headline h2, h2')?.textContent || '').trim()}`;
    const q = await fillCustomQuestions(jobContext, consumed);

    // Anything still empty and required → highlight.
    document.querySelectorAll('input[required], textarea[required], select[required]').forEach((el) => {
      if (!el.value && el.type !== 'hidden') mark(el.closest('.application-question, .field') || el, 'needs');
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
  // Many ATS (Greenhouse embed, Ashby, Workable) render the form client-side after load.
  const obs = new MutationObserver(() => injectButton());
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 20000);
})();
