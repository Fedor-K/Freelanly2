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
  // profile; anything we can't answer (or non-text controls) gets highlighted for the human.
  async function fillCustomQuestions(jobContext) {
    const inputs = Array.from(document.querySelectorAll('input[name^="cards["], textarea[name^="cards["]'));
    let ai = 0, manual = 0;
    for (const el of inputs) {
      if (el.type === 'radio' || el.type === 'checkbox' || el.type === 'file') { manual++; mark(el.closest('.application-question') || el, 'needs'); continue; }
      if (el.value) continue; // don't overwrite anything the user typed
      const card = el.closest('.application-question, li, .custom-question');
      const label = card ? (card.querySelector('.application-label, .text, label')?.textContent || '').trim() : '';
      if (!label) { manual++; mark(el, 'needs'); continue; }
      const res = await send({ type: 'answer', question: label, jobContext });
      if (res && res.answer) { setValue(el, res.answer); mark(el, 'ok'); ai++; }
      else { manual++; mark(card || el, 'needs'); }
    }
    return { ai, manual };
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
    if (!res.pro) {
      toast('Autofill is a PRO feature ($5/mo). Upgrade at freelanly.com → Billing, then try again.');
      window.open('https://freelanly.com/dashboard/billing?src=extension', '_blank');
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
  // Lever pages are static, but the apply form can render after load on some templates.
  const obs = new MutationObserver(() => injectButton());
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 15000);
})();
