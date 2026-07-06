'use client';

import { useState, useEffect, useRef } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { SalaryPicker } from '@/components/SalaryPicker';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { categories, languages } from '@/config/site';

interface ProjectProps {
  project: {
    id: string;
    title: string;
    description: string;
    companyName: string;
    skills: string[];
    location: string | null;
    locationType: string | null;
    country: string | null;
    level: string | null;
    category: string | null;
    postedAgo: string;
    sourceUrl: string | null;
    poster: { name: string; headline: string | null; avatar: string | null; linkedIn: string | null } | null;
  };
  signals: { applicationCount: number; isEarly: boolean; totalProjects: number };
  similar: Array<{ slug: string; title: string; companyName: string; skills: string[] }>;
}

type Phase = 'guest' | 'auth' | 'analyzing' | 'summary' | 'generating' | 'review' | 'sent';

// One continuous status sequence covering the whole flow: building the profile (résumé + LinkedIn)
// AND assessing the match — shown on a single processing screen so it reads as one process.
const ANALYZE_STEPS = [
  { title: 'Uploading your résumé…', sub: 'Securely storing your PDF' },
  { title: 'Reading your LinkedIn…', sub: 'Pulling your experience & skills' },
  { title: 'Building your profile…', sub: 'Structuring your background' },
  { title: 'Reading the job post…', sub: 'Understanding what this role needs' },
  { title: 'Assessing your fit…', sub: 'Matching you to this role & others' },
  { title: 'Almost ready…', sub: 'Preparing your summary' },
];

// Rotating status lines for the cover-letter generation screen (so it reads as live work).
const GEN_STEPS = [
  { title: 'Reading the job post…', sub: 'Understanding what this role needs' },
  { title: 'Matching your profile…', sub: 'Comparing your skills & experience' },
  { title: 'Writing your cover letter…', sub: 'Drafting a tailored intro for you' },
  { title: 'Polishing the wording…', sub: 'Making it sound like you' },
  { title: 'Almost ready…', sub: 'Final touches' },
];

export function ProjectPageClient({ project, signals, similar }: ProjectProps) {
  const { track } = useTracker();
  const startTime = useRef(Date.now());
  const scrollDepth = useRef(0);

  // Main phase
  const [phase, setPhase] = useState<Phase>('guest');

  // Auth state
  const [email, setEmail] = useState('');
  const [isExisting, setIsExisting] = useState<boolean | null>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [regToken, setRegToken] = useState<string | null>(null); // deferred-session proof from verify-code
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [githubUrlField, setGithubUrlField] = useState('');
  const [salaryExpectation, setSalaryExpectation] = useState('');
  const [currentRate, setCurrentRate] = useState('');
  const [workAuth, setWorkAuth] = useState('');
  const [noticeForm, setNoticeForm] = useState(''); // notice period collected IN the form (recruiters re-ask)
  const [shareConsent, setShareConsent] = useState(false); // GDPR/CCPA opt-in to present profile to employers/partners
  const [tgState, setTgState] = useState<'idle' | 'opening' | 'opened'>('idle');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  // §4 opt-in scaffold — explicit consent (default off) to future job-alert emails; sending suspended.
  // After the OTP code is confirmed we reveal the profile fields (résumé/LinkedIn/categories).
  // Until the code is entered the user only sees the email step — no fields at all.
  const [profileStep, setProfileStep] = useState(false);
  // Rotating status index for the "generating" screen so it reads as live work, not a freeze.
  const [genStepIdx, setGenStepIdx] = useState(0);

  // OTP state
  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Cover letter state
  const [coverLetter, setCoverLetter] = useState('');
  const [matchSummary, setMatchSummary] = useState<{ who: string; fit: string; otherRoles: string[] } | null>(null);
  const [matchLabel, setMatchLabel] = useState<string | null>(null);
  const [matchTier, setMatchTier] = useState<'strong' | 'good' | 'weak'>('good');
  const [gated, setGated] = useState(false); // true = a send would be refused → don't offer the cover-letter path
  const [smtpPrompt, setSmtpPrompt] = useState(''); // set when the block is "connect your email to send yourself"
  const [suggestions, setSuggestions] = useState<{ slug: string; title: string; company: string }[]>([]);
  const [subject, setSubject] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [genError, setGenError] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Check if already authenticated + auto-apply on ?apply=1
  const [isAuthed, setIsAuthed] = useState(false);

  // Post-submit (optional, off the critical path): expected pay → fills the breakdown's salary line.
  const SALARY_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'PKR', 'PHP', 'IDR', 'NGN', 'BDT', 'BRL', 'EGP', 'AED', 'CAD', 'AUD'];
  const [salaryAmt, setSalaryAmt] = useState('');
  const [salaryCur, setSalaryCur] = useState('USD');
  const [salaryPer, setSalaryPer] = useState('mo');
  const [salarySaved, setSalarySaved] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const saveSalary = async () => {
    if (!salaryAmt.trim()) return;
    setSalarySaving(true);
    try {
      const r = await fetch('/api/user/salary-expectation', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: salaryAmt, period: salaryPer, currency: salaryCur }),
      });
      if (r.ok) setSalarySaved(true);
    } catch { /* optional step — never block */ } finally { setSalarySaving(false); }
  };

  // Same post-submit pattern: two fields recruiters re-ask for (start date 27%, portfolio 14%).
  const NOTICE_OPTIONS = ['Immediately', 'Within 2 weeks', 'Within a month', 'More than a month'];
  const [noticeFrom, setNoticeFrom] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [extraSaved, setExtraSaved] = useState(false);
  const [extraSaving, setExtraSaving] = useState(false);
  const saveExtra = async () => {
    if (!noticeFrom && !portfolio.trim()) return;
    setExtraSaving(true);
    try {
      const r = await fetch('/api/user/profile-extra', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableFrom: noticeFrom || undefined, portfolioUrl: portfolio.trim() || undefined }),
      });
      if (r.ok) setExtraSaved(true);
    } catch { /* optional step — never block */ } finally { setExtraSaving(false); }
  };
  useEffect(() => {
    const hasApplyFlag = new URLSearchParams(window.location.search).get('apply') === '1';

    // If ?apply=1, skip settings check and go straight to cover letter
    if (hasApplyFlag) {
      const url = new URL(window.location.href);
      url.searchParams.delete('apply');
      window.history.replaceState({}, '', url.toString());
      setIsAuthed(true);
      // First analyze the profile and show the match summary — the user reads "who you are / fit /
      // other roles" and clicks through to WRITE the application (cover letter) themselves. We do
      // NOT generate the cover letter yet (summaryOnly), so no LLM spend until they proceed.
      setPhase('analyzing');
      fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, summaryOnly: true }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error === 'already_applied') {
            track('APPLY_DRAFT', { method: 'project', ok: false, reason: 'already_applied', opportunityId: project.id });
            setGenError('You already applied to this project.');
            setPhase('sent');
            return;
          }
          setMatchSummary(data.matchSummary || null);
          setMatchLabel(data.matchLabel || null);
          setMatchTier(data.tier || 'good');
          setGated(!!data.gated);
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setSendTo(data.to || '');
          // Strong/Good → skip the preview, write straight away; preview only for weak (steers to
          // better-fitting roles). Log the weak-gate outcome here (generateCoverLetter logs the rest).
          if (data.tier === 'weak') {
            track('APPLY_DRAFT', { method: 'project', ok: false, reason: 'poor_match', opportunityId: project.id });
            setPhase('summary');
          } else generateCoverLetter();
        })
        .catch(() => { setPhase('summary'); });
      return;
    }

    // Normal auth check
    fetch('/api/user/settings', { method: 'GET', credentials: 'include' })
      .then(r => { if (r.ok) setIsAuthed(true); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Advance the "generating" status messages so the screen reads as live work, not a freeze.
  // Resets to 0 whenever we (re-)enter the generating phase; stops advancing on the last step.
  useEffect(() => {
    if (phase !== 'generating') { setGenStepIdx(0); return; }
    setGenStepIdx(0);
    const id = setInterval(() => setGenStepIdx(i => Math.min(i + 1, GEN_STEPS.length - 1)), 2600);
    return () => clearInterval(id);
  }, [phase]);

  // Track page view
  useEffect(() => {
    track('PAGE_VIEW', { page: 'project', projectId: project.id, title: project.title, company: project.companyName });
    const handleScroll = () => {
      const depth = Math.round((window.scrollY + window.innerHeight) / document.body.scrollHeight * 100);
      if (depth > scrollDepth.current) scrollDepth.current = depth;
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      track('PAGE_VIEW', { page: 'project_exit', projectId: project.id, timeSpent: Math.round((Date.now() - startTime.current) / 1000), scrollDepth: scrollDepth.current });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check email on blur
  async function checkEmail() {
    if (!email || !email.includes('@') || !email.includes('.')) return;
    setCheckingEmail(true);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setIsExisting(data.exists);
      setHasResume(data.hasResume ?? false);
    } catch {
      setIsExisting(null);
      setHasResume(null);
    } finally {
      setCheckingEmail(false);
    }
  }

  // Send OTP code
  async function handleSendCode() {
    if (!email || isExisting === null) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      // STEP 1 = EMAIL ONLY. No résumé/LinkedIn/category fields here — they're collected only
      // AFTER the user confirms the OTP code (see profileStep / handleProfileSubmit). Email
      // verification is the gate: an unconfirmed visitor never even sees the fields, and we
      // process nothing for them. Register the new user with email only and trigger the code.
      if (hasResume === false && isExisting === false) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            categories: [],
            agreedToTerms: true,
            // Registration attribution (single chokepoint): inline apply on a project page.
            entryPoint: 'freelance_inline',
            opportunityId: project.id,
            pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
          }),
        });
        if (!regRes.ok) {
          const data = await regRes.json();
          throw new Error(data.error || 'Registration failed');
        }
      }

      // Send magic link / OTP
      const { signIn } = await import('next-auth/react');
      await signIn('resend', { email, callbackUrl: '/dashboard/discovery', redirect: false });

      setCodeSent(true);
      setOtpCode('');
      setOtpError('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  }

  // Verify OTP → generate cover letter
  async function handleOtpSubmit(code: string) {
    if (code.length !== 6) return;
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // flow:'register' for new (résumé-less) users → verify-code confirms the OTP but DEFERS the
        // session; it hands back a regToken that resume-preauth uses to create the session once the
        // profile is complete. So no session exists until the résumé + required fields are saved.
        body: JSON.stringify({ email, code, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, flow: (hasResume === false && isExisting === false) ? 'register' : undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Email CONFIRMED. New users (no résumé yet) now move to the profile step to enter their
        // résumé/LinkedIn/categories — nothing was collected before this point. Existing users who
        // already have a résumé skip straight to applying.
        if (hasResume === false) {
          if (data.regToken) setRegToken(data.regToken); // needed to mint the session after the résumé
          setProfileStep(true);
          return; // finally{} clears otpLoading; the fields step renders next
        }
        const url = new URL(window.location.href);
        url.searchParams.set('apply', '1');
        window.location.href = url.toString();
        return;
      } else {
        setOtpError(data.error || 'Invalid code');
        setOtpCode('');
      }
    } catch {
      setOtpError('Something went wrong');
    } finally {
      setOtpLoading(false);
    }
  }

  // Open the Telegram deep link so the user gets recruiter-reply alerts in Telegram. Auth-gated
  // (telegram-link needs the session) — only reachable on the post-code profile step. Linking
  // completes when they tap Start in the bot (the bot webhook sets telegramChatId).
  async function connectTelegram() {
    setTgState('opening');
    try {
      const r = await fetch('/api/user/telegram-link', { method: 'POST' });
      const d = await r.json();
      if (d.url) { window.open(d.url, '_blank'); setTgState('opened'); }
      else setTgState('idle');
    } catch { setTgState('idle'); }
  }

  // STEP 3 (only reachable AFTER the OTP code is confirmed): collect résumé/LinkedIn/categories,
  // build the profile, then apply. An unverified visitor never reaches this — they're stopped at
  // the code step and never see these fields.
  async function handleProfileSubmit() {
    const errors: Record<string, boolean> = {};
    if (!resumeFile) errors.resume = true;
    if (!linkedinUrl) errors.linkedin = true;
    if (!workAuth) errors.workAuth = true;
    if (!currentRate.trim()) errors.currentRate = true;
    if (!salaryExpectation.trim()) errors.salary = true;
    if (!noticeForm) errors.notice = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setAuthError('Please fill in all required fields');
      return;
    }
    setFieldErrors({});
    setAuthError('');
    // STAGE 1 — save the profile (résumé upload + LinkedIn scrape + AI parse). Keep the form MOUNTED
    // (loading state on the button, NOT phase='analyzing') so that if the save fails, the user stays on
    // the form with everything they typed intact — leaving to a processing screen and coming back was
    // remounting the form (and SalaryPicker's onChange-on-mount wiped the rate/salary), i.e. the "form
    // reset on Continue" bug. Only a SUCCESSFUL save advances to the processing screen.
    setAuthLoading(true);
    let pre: Response | null = null;
    try {
      const fd = new FormData();
      fd.append('file', resumeFile!);
      fd.append('email', email);
      fd.append('linkedinUrl', linkedinUrl);
      fd.append('githubUrl', githubUrlField.trim());
      fd.append('salaryExpectation', salaryExpectation.trim());
      fd.append('currentRate', currentRate.trim());
      fd.append('workAuthorization', workAuth);
      fd.append('availableFrom', noticeForm);
      fd.append('profileShareConsent', shareConsent ? 'true' : 'false');
      if (regToken) fd.append('regToken', regToken); // resume-preauth mints the session once this saves
      pre = await fetch('/api/user/resume-preauth', { method: 'POST', body: fd });
    } catch { pre = null; }
    if (!pre || !pre.ok) {
      const d = pre ? await pre.json().catch(() => ({})) : {};
      setAuthLoading(false);
      setAuthError(typeof (d as { error?: string }).error === 'string' ? (d as { error?: string }).error! : 'Could not save your profile — check your résumé and try again.');
      setFieldErrors({ resume: true });
      return; // form stays mounted → every field (incl. rate/salary) is preserved
    }

    // STAGE 2 — profile saved. NOW move to the processing screen and assess the match. If assessment
    // itself fails we fail-open to the write screen (the résumé is already saved).
    setIsAuthed(true);
    setAuthLoading(false);
    setPhase('analyzing');
    try {
      const res = await fetch('/api/user/quick-apply', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, summaryOnly: true }),
      });
      const data = await res.json();
      if (data.error === 'already_applied') { setGenError('You already applied to this project.'); setPhase('sent'); return; }
      setMatchSummary(data.matchSummary || null);
      setMatchLabel(data.matchLabel || null);
      setMatchTier(data.tier || 'good');
      setGated(!!data.gated);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setSendTo(data.to || '');
      // Strong/Good → skip the preview, write the application straight away. The preview only earns its
      // place on a WEAK match, where it honestly steers the user to better-fitting roles.
      if (data.tier === 'weak') setPhase('summary');
      else generateCoverLetter();
    } catch {
      setPhase('summary'); // fail-open: still let the user proceed to write the application
    }
  }

  // Generate AI cover letter
  async function generateCoverLetter() {
    setGenError('');
    setPhase('generating');
    try {
      const res = await fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, draftOnly: true }),
      });
      const data = await res.json();
      // Outcome of the draft step (so the project page's apply funnel isn't a blind spot like the feed's):
      // ok = draft generated (sendable); else the block reason (smtp_required / poor_match / already_applied
      // / resume_required). This is what lets us break down project-page applies by why they don't send.
      track('APPLY_DRAFT', { method: 'project', ok: res.ok, status: res.status, reason: res.ok ? null : (data.error || null), opportunityId: project.id });
      if (res.ok) {
        setCoverLetter(data.coverLetter || '');
        setSubject(data.subject || `Application: ${project.title}`);
        setSendTo(data.to || '');
        setMatchSummary(data.matchSummary || null);
        setMatchLabel(data.matchLabel || null);
        setPhase('review');
      } else {
        if (data.error === 'resume_required') {
          setGenError('Resume required. Please go back and upload your resume.');
          setPhase('auth');
        } else if (data.error === 'already_applied') {
          setGenError('You already applied to this project.');
          setPhase('sent');
        } else if (data.error === 'smtp_required' || data.error === 'poor_match') {
          // Our-name (Postal) sending is reserved for the strongest matches; anything below the bar
          // routes to the honest gated summary with the "connect your email to send it yourself"
          // path (and, for a genuine poor match, better-matching roles).
          setMatchTier(data.reason === 'poor_match' || data.error === 'poor_match' ? 'weak' : 'good');
          setMatchLabel(data.matchLabel || 'Good');
          setGated(true);
          setSmtpPrompt(data.message || 'Connect your own email to send this yourself — from your address, no limits.');
          if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
          setGenError('');
          setPhase('summary');
        } else {
          // Let user write their own
          setCoverLetter('');
          setSubject(`Application: ${project.title}`);
          setSendTo('');
          setGenError(data.error || 'Could not generate cover letter. Write your own below.');
          setPhase('review');
        }
      }
    } catch {
      setCoverLetter('');
      setSubject(`Application: ${project.title}`);
      setGenError('Generation failed. Write your cover letter below.');
      setPhase('review');
    }
  }

  // Send application
  async function handleSend() {
    setSending(true);
    setSendError('');
    try {
      const res = await fetch('/api/user/quick-apply', { credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: project.id, coverLetter, subject }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSendTo(data.sentTo || sendTo);
        setPhase('sent');
        track('JOB_APPLY', { projectId: project.id, method: 'project_page' });
      } else {
        setSendError(data.message || data.error || 'Failed to send');
      }
    } catch {
      setSendError('Network error. Try again.');
    } finally {
      setSending(false);
    }
  }

  // Whether code has been sent (we're waiting for OTP)
  const [codeSent, setCodeSent] = useState(false);

  // Render CTA card content based on phase
  function renderCTA() {
    // PHASE: GUEST — show "Apply now" button
    if (phase === 'guest') {
      return (
        <>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px', letterSpacing: '-0.02em' }}>Apply with AI cover letter</h2>
          <p style={{ fontSize: '14px', color: '#8A8780', lineHeight: 1.5, marginBottom: '20px' }}>
            AI writes a personalized application in 19 seconds. Just upload your resume.
          </p>
          <button onClick={() => {
            // method='project' distinguishes this from feed clicks; authed=true means it's a real send
            // attempt (→ draft), authed=false means it kicks off registration (not a send attempt).
            track('OPPORTUNITY_APPLY_CLICK', { projectId: project.id, method: 'project', authed: isAuthed });
            if (isAuthed) {
              setPhase('generating');
              generateCoverLetter();
            } else {
              setPhase('auth');
            }
          }} style={{
            width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
            borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
          }}>
            Apply now — free
          </button>
          <div style={{ marginTop: '16px', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
            No credit card · First 20 applications free
          </div>
        </>
      );
    }

    // PHASE: AUTH — email + onboarding fields + OTP
    if (phase === 'auth') {
      // STEP 3: profile fields — reached ONLY after the OTP code is confirmed (profileStep=true).
      // An unverified visitor never gets here.
      if (profileStep) {
        return (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>Email confirmed ✓</h2>
            <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '12px' }}>Now tell us about you so we can apply.</p>

            {/* Resume upload */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: fieldErrors.resume ? '#B91C1C' : '#555', display: 'block', marginBottom: '4px' }}>Resume (PDF) <span style={{ color: '#B91C1C' }}>*</span></label>
              <div
                onClick={() => { const inp = document.getElementById('resume-input') as HTMLInputElement; inp?.click(); }}
                style={{ padding: '10px 14px', border: `1px dashed ${fieldErrors.resume ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '13px', color: resumeFile ? '#047857' : '#8A8780', cursor: 'pointer', background: resumeFile ? '#ECFDF5' : '#fff' }}
              >
                {resumeFile ? `✓ ${resumeFile.name}` : 'Click to upload PDF or DOCX'}
                <input id="resume-input" type="file" accept="application/pdf,.pdf,.docx" hidden onChange={e => {
                  const f = e.target.files?.[0];
                  const nm = (f?.name || '').toLowerCase();
                  // Backend parses PDF (unpdf) + DOCX (mammoth); reject anything else at the picker so the
                  // user gets told, not silently 400'd on submit.
                  if (f && !(nm.endsWith('.pdf') || nm.endsWith('.docx'))) { setAuthError('Please upload a PDF or DOCX résumé.'); setFieldErrors(p => ({ ...p, resume: true })); e.target.value = ''; return; }
                  setFieldErrors(p => { const n = { ...p }; delete n.resume; return n; }); setAuthError(''); setResumeFile(f || null);
                }} />
              </div>
            </div>

            {/* LinkedIn */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: fieldErrors.linkedin ? '#B91C1C' : '#555', display: 'block', marginBottom: '4px' }}>LinkedIn <span style={{ color: '#B91C1C' }}>*</span></label>
              <input
                type="url" placeholder="linkedin.com/in/yourname" value={linkedinUrl}
                onChange={e => setLinkedinUrl(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${fieldErrors.linkedin ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            {/* GitHub — optional; a verified GitHub is skills evidence for hirers */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>GitHub <span style={{ color: '#9A958A', fontWeight: 400 }}>(optional — gets you shortlisted faster)</span></label>
              <input
                type="url" placeholder="github.com/username" value={githubUrlField}
                onChange={e => setGithubUrlField(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            {/* The fields recruiters re-ask for on every reply (work auth, current + expected pay,
                notice). Captured up front and put in the first outreach email → no "share details"
                round. Optional, but the more filled, the fewer back-and-forths. */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Where can you legally work? <span style={{ color: '#B91C1C', fontWeight: 400 }}>*</span></label>
              <select value={workAuth} onChange={e => setWorkAuth(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${fieldErrors.workAuth ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                <option value="">Select…</option>
                <option value="Remote — anywhere / worldwide (non US)">Remote — anywhere / worldwide (non US)</option>
                <option value="My country only">My country only</option>
                <option value="US-authorized (citizen / GC / valid visa)">US-authorized (citizen / GC / valid visa)</option>
                <option value="EU-authorized">EU-authorized</option>
                <option value="UK-authorized">UK-authorized</option>
                <option value="Canada-authorized">Canada-authorized</option>
                <option value="Need sponsorship">Need sponsorship</option>
              </select>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Current rate / pay <span style={{ color: '#B91C1C', fontWeight: 400 }}>*</span></label>
              <SalaryPicker single onChange={setCurrentRate} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Expected salary <span style={{ color: '#B91C1C', fontWeight: 400 }}>*</span></label>
              <SalaryPicker onChange={setSalaryExpectation} />
            </div>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Notice period / when can you start? <span style={{ color: '#B91C1C', fontWeight: 400 }}>*</span></label>
              <select value={noticeForm} onChange={e => setNoticeForm(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: `1px solid ${fieldErrors.notice ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '14px', background: '#fff' }}>
                <option value="">Select…</option>
                {NOTICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            {/* Telegram reply alerts — optional. Recruiter replies are easy to miss in email;
                Telegram pings instantly. Opens the bot deep link; linking finishes on Start. */}
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Get recruiter-reply alerts on Telegram <span style={{ color: '#8A8780', fontWeight: 400 }}>(optional)</span></label>
              <button
                type="button"
                onClick={connectTelegram}
                disabled={tgState === 'opening'}
                style={{ width: '100%', padding: '10px 12px', background: tgState === 'opened' ? '#ECFDF5' : '#fff', color: tgState === 'opened' ? '#047857' : '#229ED9', border: `1px solid ${tgState === 'opened' ? '#A7F3D0' : '#229ED9'}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
              >
                {tgState === 'opened' ? '✓ Telegram opened — tap Start in the bot' : tgState === 'opening' ? 'Opening…' : '✈ Connect Telegram for instant alerts'}
              </button>
            </div>

            {/* Affirmative opt-in to share profile with employers/partners (GDPR/CCPA) — unchecked by default. */}
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: '#555', cursor: 'pointer', lineHeight: 1.4, marginBottom: '10px' }}>
              <input type="checkbox" checked={shareConsent} onChange={e => setShareConsent(e.target.checked)} style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>Let Freelanly share my profile with employers and hiring partners so they can reach out about jobs.</span>
            </label>

            <div style={{ fontSize: '11px', color: '#8A8780', marginBottom: '8px' }}><span style={{ color: '#B91C1C' }}>*</span> Required fields</div>
            {authError && <div style={{ fontSize: '13px', color: '#B91C1C', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '8px' }}>{authError}</div>}

            <button
              onClick={handleProfileSubmit}
              disabled={authLoading}
              style={{
                width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
                borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
                opacity: authLoading ? 0.6 : 1,
              }}
            >
              {authLoading ? 'Setting up your profile...' : 'Continue →'}
            </button>
          </div>
        );
      }

      if (codeSent) {
        // OTP input
        return (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: '10px', background: '#ECFDF5', borderRadius: '10px', fontSize: '13px', color: '#047857', marginBottom: '12px' }}>
              Code sent to {email}
            </div>
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code"
              placeholder="000000" value={otpCode}
              onChange={e => {
                // No maxLength on the raw input: codes are e-mailed spaced ("497 214"), and a
                // maxLength={6} would truncate the spaced paste to "497 21" BEFORE we strip the
                // space → dropping the last digit. Strip non-digits, THEN cap at 6.
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtpCode(v);
                setOtpError('');
                if (v.length === 6) handleOtpSubmit(v);
              }}
              autoFocus disabled={otpLoading}
              style={{ width: '100%', padding: '14px', border: `1px solid ${otpError ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '24px', textAlign: 'center', letterSpacing: '12px', fontWeight: 600, marginBottom: '8px', fontFamily: "'Geist Mono', monospace" }}
            />
            {otpError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{otpError}</div>}
            {otpLoading && <div style={{ fontSize: '12px', color: '#047857' }}>Verifying...</div>}
            {genError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{genError}</div>}
            {/* The single biggest drop-off is here: cold Gmail can file the code under Spam/Promotions.
                A nudge to check those folders recovers users who'd otherwise think nothing arrived. */}
            <div style={{ fontSize: '12px', color: '#8A8780', marginTop: '6px', lineHeight: 1.5 }}>
              Didn&apos;t get it? Check <b>Spam</b> or <b>Promotions</b>.{' '}
              <button onClick={() => { setOtpCode(''); setOtpError(''); handleSendCode(); }} disabled={otpLoading} style={{ color: '#3F6212', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline' }}>
                Resend code
              </button>
            </div>
            <button onClick={() => { setCodeSent(false); setOtpCode(''); setOtpError(''); }} style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px' }}>
              ← Back
            </button>
          </div>
        );
      }

      // Email + onboarding fields
      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Enter your email to apply</h2>

          <input
            type="email" placeholder="you@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setIsExisting(null); setHasResume(null); }}
            onBlur={checkEmail}
            onKeyDown={e => e.key === 'Enter' && isExisting !== null && handleSendCode()}
            autoFocus
            style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '14px', marginBottom: '8px' }}
          />
          {checkingEmail && <div style={{ fontSize: '11px', color: '#8A8780', marginBottom: '8px' }}>Checking...</div>}

          {/* Fields (résumé/LinkedIn/work type) are intentionally NOT here — they appear only after
              the OTP code is confirmed (profileStep). Step 1 collects the email and nothing else. */}

          {authError && <div style={{ fontSize: '13px', color: '#B91C1C', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '8px' }}>{authError}</div>}

          <button
            onClick={handleSendCode}
            disabled={authLoading || isExisting === null}
            style={{
              width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
              opacity: authLoading || isExisting === null ? 0.6 : 1,
            }}
          >
            {authLoading ? 'Sending code...' : 'Send me a code →'}
          </button>

          <button onClick={() => setPhase('guest')} style={{ fontSize: '12px', color: '#8A8780', background: 'none', border: 'none', cursor: 'pointer', marginTop: '8px', display: 'block', margin: '8px auto 0' }}>
            ← Back
          </button>
        </div>
      );
    }

    // PHASE: ANALYZING — building the match summary (before the user reads it)
    if (phase === 'analyzing') {
      return <ProcessingScreen steps={ANALYZE_STEPS} emoji="🔍" />;
    }

    // PHASE: SUMMARY — the user reads "who you are / fit for this role / other roles", THEN clicks
    // through to write the application. The cover letter is generated only on that click.
    if (phase === 'summary') {
      const weak = matchTier === 'weak';
      // Card palette by tier: green for a real fit, amber for "this one's a stretch".
      const cardBg = weak ? '#FFF8EC' : '#F6FAEF';
      const cardBorder = weak ? '#F2D9A8' : '#DDEBC4';
      const badgeColor = weak ? '#92400E' : '#3F6212';
      const badgeBg = weak ? '#FDE9C8' : '#D9F99D';

      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {weak ? 'Honest take on this one' : 'Here’s your match'}
          </h2>
          <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '14px' }}>
            {weak
              ? 'We read your résumé & LinkedIn — and we won’t send a mismatch on your behalf.'
              : 'We read your résumé & LinkedIn. Review, then write your application.'}
          </p>

          <div style={{ marginBottom: '16px', padding: '14px', background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: '12px' }}>
            {matchLabel && <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '11px', fontWeight: 600, color: badgeColor, background: badgeBg, padding: '3px 10px', borderRadius: '999px' }}>{matchLabel} match</span></div>}
            {matchSummary?.who && <p style={{ fontSize: '14px', color: '#2A2A26', margin: '0 0 8px', lineHeight: 1.5, fontWeight: 500 }}>{matchSummary.who}</p>}
            {matchSummary?.fit && <p style={{ fontSize: '13px', color: '#555', margin: '0 0 10px', lineHeight: 1.5 }}><b>Fit for {project.title}:</b> {matchSummary.fit}</p>}
            {!weak && (matchSummary?.otherRoles?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>You&apos;re also a strong fit for</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {matchSummary!.otherRoles.map((r, i) => (
                    <span key={i} style={{ fontSize: '12px', padding: '4px 10px', background: '#fff', border: '1px solid #DDEBC4', borderRadius: '6px', color: '#3F6212' }}>{r}</span>
                  ))}
                </div>
              </div>
            )}
            {!matchSummary && <p style={{ fontSize: '13px', color: '#8A8780', margin: 0 }}>Profile ready — let&apos;s write your application.</p>}
          </div>

          {weak ? (
            <>
              <p style={{ fontSize: '13px', color: '#6B6862', lineHeight: 1.55, margin: '0 0 14px' }}>
                We could fire off an application here — but recruiters skip mismatches, and it would just
                burn one of your daily applies. You&apos;ll get a real reply faster from roles that actually fit you.
              </p>

              {suggestions.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>Better matches for you</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {suggestions.map((s) => (
                      <a key={s.slug} href={`/freelance/${s.slug}?apply=1`} style={{ display: 'block', padding: '12px 14px', background: '#fff', border: '1px solid #E4E1D9', borderRadius: '10px', textDecoration: 'none' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A17', marginBottom: s.company ? '2px' : 0 }}>{s.title}</div>
                        {s.company && <div style={{ fontSize: '12px', color: '#8A8780' }}>{s.company}</div>}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {gated ? (
                // Below the our-name (Postal) bar. Offer the honest self-send path: connect your own
                // inbox and send this (and anything) yourself, no limits.
                <div style={{ textAlign: 'center', margin: '4px 0 0' }}>
                  <p style={{ fontSize: '12px', color: '#8A8780', margin: '0 0 10px', lineHeight: 1.5 }}>
                    {smtpPrompt || 'We send our strongest matches from Freelanly. Connect your own email to send this yourself — from your address, no limits.'}
                  </p>
                  <a href="/dashboard/settings#integrations" style={{ display: 'inline-block', padding: '10px 18px', background: '#C7F94A', color: '#000', borderRadius: '10px', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                    ✉️ Connect my email →
                  </a>
                </div>
              ) : (
                <button
                  onClick={generateCoverLetter}
                  style={{ width: '100%', padding: '12px', background: 'transparent', color: '#8A8780', border: '1px solid #E4E1D9', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
                >
                  Apply here anyway
                </button>
              )}
            </>
          ) : (
            <button
              onClick={generateCoverLetter}
              style={{ width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              Write my application →
            </button>
          )}
        </div>
      );
    }

    // PHASE: GENERATING
    if (phase === 'generating') {
      const step = GEN_STEPS[genStepIdx] || GEN_STEPS[0];
      const pct = Math.round(((genStepIdx + 1) / GEN_STEPS.length) * 100);
      return (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <style>{`
            @keyframes fl-spin { to { transform: rotate(360deg); } }
            @keyframes fl-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.9); } }
            @keyframes fl-bar { from { background-position: 0 0; } to { background-position: 28px 0; } }
          `}</style>
          {/* spinning ring around a pulsing pen — unmistakably "working" */}
          <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 18px' }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #ECEAE3', borderTopColor: '#C7F94A', animation: 'fl-spin .9s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'fl-pulse 1.6s ease-in-out infinite' }}>✍️</div>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>{step.title}</h2>
          <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px', minHeight: 18 }}>{step.sub}</p>
          {/* animated striped progress bar that fills step-by-step */}
          <div style={{ width: '72%', maxWidth: 260, height: 6, margin: '0 auto', background: '#ECEAE3', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, transition: 'width .6s ease', backgroundImage: 'repeating-linear-gradient(45deg, #C7F94A 0, #C7F94A 8px, #b6e842 8px, #b6e842 16px)', backgroundSize: '28px 28px', animation: 'fl-bar 1s linear infinite' }} />
          </div>
          <p style={{ fontSize: '11px', color: '#B3AFA6', marginTop: 10 }}>This usually takes a few seconds…</p>
        </div>
      );
    }

    // PHASE: REVIEW
    if (phase === 'review') {
      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Review & send</h2>

          {sendTo && (
            <div style={{ fontSize: '12px', color: '#8A8780', marginBottom: '8px', fontFamily: "'Geist Mono', monospace" }}>
              To: {sendTo}
            </div>
          )}

          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Subject</label>
            <input
              value={subject} onChange={e => setSubject(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px', marginTop: '4px' }}
            />
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: '#8A8780', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cover letter</label>
            <textarea
              value={coverLetter} onChange={e => setCoverLetter(e.target.value)}
              rows={8}
              style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px', lineHeight: 1.6, resize: 'vertical', marginTop: '4px' }}
            />
          </div>

          {genError && <div style={{ fontSize: '12px', color: '#B45309', marginBottom: '8px' }}>{genError}</div>}
          {sendError && <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>{sendError}</div>}

          <button
            onClick={handleSend}
            disabled={sending || !coverLetter.trim()}
            style={{
              width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer',
              opacity: sending ? 0.6 : 1,
            }}
          >
            {sending ? 'Sending...' : 'Send application →'}
          </button>

        </div>
      );
    }

    // PHASE: SENT
    if (phase === 'sent') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: '48px', height: '48px', background: '#ECFDF5', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>Application sent!</h2>
          {sendTo && <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px' }}>Sent to {sendTo}</p>}
          {genError && <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px' }}>{genError}</p>}

          {/* Optional, OFF the critical path — expected rate fills the recruiter breakdown's salary line. */}
          {!salarySaved ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DC', borderRadius: '12px', padding: '14px', margin: '0 0 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Add your expected rate</div>
              <div style={{ fontSize: '12px', color: '#8A8780', margin: '2px 0 10px' }}>Recruiters prioritize candidates who state it — optional.</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <select value={salaryCur} onChange={e => setSalaryCur(e.target.value)} aria-label="Currency"
                  style={{ padding: '9px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }}>
                  {SALARY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <input value={salaryAmt} onChange={e => setSalaryAmt(e.target.value)} inputMode="numeric" placeholder="e.g. 1500"
                  style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }} />
                <select value={salaryPer} onChange={e => setSalaryPer(e.target.value)}
                  style={{ padding: '9px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="mo">/ month</option><option value="hr">/ hour</option><option value="yr">/ year</option>
                </select>
                <button onClick={saveSalary} disabled={salarySaving || !salaryAmt.trim()}
                  style={{ padding: '9px 14px', background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: salarySaving || !salaryAmt.trim() ? 'default' : 'pointer', opacity: salarySaving || !salaryAmt.trim() ? 0.5 : 1 }}>
                  {salarySaving ? '…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#047857', margin: '0 0 16px' }}>✓ Saved — recruiters will see your expected rate.</p>
          )}

          {/* Two more fields recruiters ask for most after the CV — start date & portfolio. Optional. */}
          {!extraSaved ? (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E5DC', borderRadius: '12px', padding: '14px', margin: '0 0 16px', textAlign: 'left' }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>When can you start? + portfolio</div>
              <div style={{ fontSize: '12px', color: '#8A8780', margin: '2px 0 10px' }}>The next things recruiters ask — answer once, they’ll see it. Optional.</div>
              <select value={noticeFrom} onChange={e => setNoticeFrom(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px', marginBottom: '8px', background: '#fff' }}>
                <option value="">When can you start?</option>
                {NOTICE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input value={portfolio} onChange={e => setPortfolio(e.target.value)} placeholder="Portfolio / GitHub / site (optional)"
                  style={{ flex: 1, minWidth: 0, padding: '9px 11px', border: '1px solid #E8E5DC', borderRadius: '8px', fontSize: '13px' }} />
                <button onClick={saveExtra} disabled={extraSaving || (!noticeFrom && !portfolio.trim())}
                  style={{ padding: '9px 14px', background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: extraSaving || (!noticeFrom && !portfolio.trim()) ? 'default' : 'pointer', opacity: extraSaving || (!noticeFrom && !portfolio.trim()) ? 0.5 : 1 }}>
                  {extraSaving ? '…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#047857', margin: '0 0 16px' }}>✓ Saved — recruiters will see when you can start.</p>
          )}

          <a href="/dashboard/discovery" style={{
            display: 'inline-block', padding: '12px 24px', background: '#C7F94A', color: '#000',
            borderRadius: '10px', fontSize: '14px', fontWeight: 600, textDecoration: 'none',
          }}>
            See more matches →
          </a>
          <p style={{ fontSize: '13px', color: '#555', marginTop: '12px', lineHeight: 1.5 }}>
            We&apos;ll notify you when the recruiter replies. Your dashboard has more gigs matched to your profile — each with a cover letter ready to review and send.
          </p>
          <a href="https://t.me/FLalarmbot" target="_blank" rel="noopener" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '12px', padding: '10px', background: '#E0F2FE', border: '1px solid #BAE6FD',
            borderRadius: '10px', textDecoration: 'none', color: '#0369A1', fontSize: '13px', fontWeight: 500,
          }}>
            <span>📱</span> Get instant alerts via Telegram
          </a>
        </div>
      );
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF7' }}>
      <style>{`
        @media (max-width: 768px) {
          .project-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
            padding: 24px 16px !important;
          }
          .project-sidebar {
            position: static !important;
            order: -1;
          }
          .project-main h1 {
            font-size: 24px !important;
          }
        }
      `}</style>
      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E8E5DC', maxWidth: '1100px', margin: '0 auto' }}>
        <a href="/" style={{ fontWeight: 700, fontSize: '18px', color: '#000', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ background: '#000', color: '#fff', width: '28px', height: '28px', display: 'grid', placeItems: 'center', borderRadius: '7px', fontSize: '13px', fontWeight: 700 }}>F</span>
          Freelanly
        </a>
        <a href="/auth/signin" style={{ padding: '8px 16px', background: '#C7F94A', color: '#000', borderRadius: '8px', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>Sign up free</a>
      </nav>

      <div className="project-layout" style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: '1fr 380px', gap: '40px', alignItems: 'start' }}>
        {/* Left: project details */}
        <div className="project-main">
          <div style={{ fontSize: '12px', color: '#8A8780', marginBottom: '16px', fontFamily: "'Geist Mono', monospace", letterSpacing: '0.04em' }}>
            <a href="/jobs" style={{ color: '#8A8780', textDecoration: 'none' }}>Jobs</a>
            {project.category && <> → <a href={`/jobs/${project.category.toLowerCase()}`} style={{ color: '#8A8780', textDecoration: 'none' }}>{project.category}</a></>}
            <> → {project.title}</>
          </div>

          <h1 style={{ fontSize: '32px', fontWeight: 600, letterSpacing: '-0.03em', marginBottom: '12px', lineHeight: 1.2 }}>{project.title}</h1>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 500, color: '#333' }}>{project.companyName}</span>
            {project.location && <span style={{ fontSize: '13px', color: '#8A8780' }}>{project.location}</span>}
            {project.level && <span style={{ fontSize: '12px', padding: '2px 8px', background: '#F0EDE5', borderRadius: '4px', color: '#555' }}>{project.level}</span>}
            <span style={{ fontSize: '12px', color: '#8A8780', fontFamily: "'Geist Mono', monospace" }}>Posted {project.postedAgo}</span>
          </div>

          {project.skills.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px' }}>
              {project.skills.map(s => (
                <span key={s} style={{ padding: '4px 10px', background: '#F0EDE5', borderRadius: '6px', fontSize: '12px', color: '#555' }}>{s}</span>
              ))}
            </div>
          )}

          <div style={{ fontSize: '15px', lineHeight: 1.7, color: '#333', whiteSpace: 'pre-wrap' }}>
            {project.description}
          </div>

          {similar.length > 0 && (
            <div style={{ marginTop: '40px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Similar projects</h3>
              {similar.map(s => (
                <a key={s.slug} href={`/freelance/${s.slug}`} onClick={() => track('JOB_VIEW', { projectId: project.id, type: 'similar_click', targetSlug: s.slug })} style={{ display: 'block', padding: '12px 16px', border: '1px solid #E8E5DC', borderRadius: '10px', marginBottom: '8px', textDecoration: 'none', color: '#333' }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{s.title}</div>
                  <div style={{ fontSize: '12px', color: '#8A8780', marginTop: '2px' }}>{s.companyName} {s.skills.length > 0 && `· ${s.skills.join(', ')}`}</div>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Right: CTA card */}
        <div className="project-sidebar" style={{ position: phase === 'guest' ? 'sticky' : 'static', top: '24px' }}>
          <div style={{ background: '#fff', border: '1px solid #E8E5DC', borderRadius: '16px', padding: '28px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)' }}>
            {/* Signals — only in guest/auth phase */}
            {(phase === 'guest' || phase === 'auth') && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                {signals.isEarly && (
                  <span style={{ padding: '4px 10px', background: '#ECFDF5', color: '#047857', borderRadius: '6px', fontSize: '11px', fontWeight: 500, fontFamily: "'Geist Mono', monospace" }}>
                    Early · {signals.applicationCount} applied
                  </span>
                )}
                <span style={{ padding: '4px 10px', background: '#FEF3C7', color: '#92400E', borderRadius: '6px', fontSize: '11px', fontWeight: 500, fontFamily: "'Geist Mono', monospace" }}>
                  1 of {signals.totalProjects.toLocaleString()} projects
                </span>
              </div>
            )}

            {renderCTA()}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '60px auto 0', padding: '24px', borderTop: '1px solid #E8E5DC', fontSize: '12px', color: '#8A8780', textAlign: 'center' }}>
        © 2026 Freelanly · <a href="/terms" style={{ color: '#8A8780' }}>Terms</a> · <a href="/privacy" style={{ color: '#8A8780' }}>Privacy</a>
      </div>
    </div>
  );
}
