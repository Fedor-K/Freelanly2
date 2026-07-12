'use client';

import { useState, useEffect, useRef } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { SalaryPicker } from '@/components/SalaryPicker';
import { ProcessingScreen } from '@/components/ProcessingScreen';
import { SmtpConnectModal } from '@/app/dashboard/settings/SmtpConnect';
import { QueueUpgradeButton } from '@/components/app/QueueUpgradeButton';
import { GoogleAuthButton } from '@/components/GoogleAuthButton';
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
    externalApplyUrl: string | null;
    poster: { name: string; headline: string | null; avatar: string | null; linkedIn: string | null } | null;
  };
  signals: { applicationCount: number; isEarly: boolean; totalProjects: number };
  similar: Array<{ slug: string; title: string; companyName: string; skills: string[] }>;
}

type Phase = 'guest' | 'auth' | 'analyzing' | 'summary' | 'generating' | 'review' | 'sent' | 'external';

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
  const [smtpModal, setSmtpModal] = useState(false); // "Connect my email" popup on the gated screen
  const [isExisting, setIsExisting] = useState<boolean | null>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [cvFromLinks, setCvFromLinks] = useState(false); // mobile no-file path: we build the CV from LinkedIn/GitHub/portfolio
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [regToken, setRegToken] = useState<string | null>(null); // deferred-session proof from verify-code
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [messenger, setMessenger] = useState(''); // WhatsApp (intl phone) or Telegram @handle — reachability
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
  const [coverage, setCoverage] = useState<{ matched: number; total: number } | null>(null); // "Covers N/M requirements" badge
  const [isProPlan, setIsProPlan] = useState(false); // PRO → "tailored CV attached" note on review
  const [matchSummary, setMatchSummary] = useState<{ who: string; fit: string; otherRoles: string[] } | null>(null);
  const [matchLabel, setMatchLabel] = useState<string | null>(null);
  const [matchTier, setMatchTier] = useState<'strong' | 'good' | 'weak'>('good');
  const [gated, setGated] = useState(false); // true = a send would be refused → don't offer the cover-letter path
  const [ownInbox, setOwnInbox] = useState(false); // Gmail OAuth or SMTP already connected → never pitch "Connect my email" again
  const [genPaywall, setGenPaywall] = useState(false); // free AI generation spent → PRO pitch on the review screen (writing manually stays free)
  const [suggestions, setSuggestions] = useState<{ slug: string; title: string; company: string }[]>([]);
  const [subject, setSubject] = useState('');
  const [sendTo, setSendTo] = useState('');
  const [genError, setGenError] = useState('');

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  // Check if already authenticated + auto-apply on ?apply=1
  const [isAuthed, setIsAuthed] = useState(false);

  // The full-screen processing takeover is a MOBILE fix (inline card gets lost under the keyboard/post).
  // On desktop it's a tiny spinner marooned in a 1920px white void — so gate it to small screens; desktop
  // uses the inline processing renders (phase 'analyzing'/'generating') + the profile button's loading state.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
    const sp = new URLSearchParams(window.location.search);
    const hasApplyFlag = sp.get('apply') === '1';
    const gmailReturn = sp.get('gmail'); // set by the Google OAuth callback (connected|denied|error)

    // Back from "Continue with Google" signup: session + verified email + gmail.send grant already
    // exist — route straight to the profile step (résumé + fields + consent). If the account turns out
    // to already have a résumé (existing user using Google as LOGIN), just continue like ?apply=1.
    if (gmailReturn) {
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      window.history.replaceState({}, '', url.toString());
      if (gmailReturn === 'connected') {
        track('FUNNEL_STEP', { step: 'google_signup_done', opportunityId: project.id });
        fetch('/api/user/settings', { method: 'GET', credentials: 'include' })
          .then(async r => {
            const d = r.ok ? await r.json().catch(() => null) : null;
            if (!d) { setPhase('auth'); return; }
            setIsAuthed(true);
            if (d.profile?.email) setEmail(d.profile.email);
            if (d.profile?.resumeUrl) {
              // Existing full account — proceed to apply exactly like ?apply=1 would.
              setHasResume(true);
              window.location.href = `${window.location.pathname}?apply=1`;
            } else {
              setHasResume(false);
              setPhase('auth');
              setProfileStep(true); // "Email confirmed ✓ — now tell us about you"
            }
          })
          .catch(() => { setPhase('auth'); });
      } else {
        track('FUNNEL_STEP', { step: gmailReturn === 'denied' ? 'google_signup_denied' : 'google_signup_error', opportunityId: project.id });
        setPhase('auth');
        setAuthError(gmailReturn === 'denied' ? 'Google sign-in was cancelled — you can try again or continue with email.' : 'Google sign-in didn’t work — continue with email below.');
      }
      return;
    }

    // If ?apply=1, skip settings check and go straight to cover letter
    if (hasApplyFlag) {
      const url = new URL(window.location.href);
      url.searchParams.delete('apply');
      window.history.replaceState({}, '', url.toString());
      setIsAuthed(true);
      // URL-apply (ATS) opportunity: skip the email flow, hand over the external link — but only if the
      // session actually has a résumé. A re-login session can be résumé-less, and ?apply=1 skips the
      // settings check above, so confirm the résumé here before handing over any external apply link;
      // otherwise route the user to the profile step to add a résumé first.
      if (project.externalApplyUrl) {
        fetch('/api/user/settings', { method: 'GET', credentials: 'include' })
          .then(async r => {
            const d = r.ok ? await r.json().catch(() => null) : null;
            if (d?.profile?.email) setEmail(d.profile.email);
            if (d?.profile?.resumeUrl) { setHasResume(true); startExternalApply(); }
            else { setHasResume(false); setPhase('auth'); setProfileStep(true); }
          })
          .catch(() => { setPhase('auth'); setProfileStep(true); });
        return;
      }
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
          setOwnInbox(!!data.ownInbox);
          setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
          setSendTo(data.to || '');
          // Strong/Good → skip the preview, write straight away. The weak preview (steers to
          // better-fitting roles) is ONLY for users without their own inbox — OWNER RULE 2026-07-11:
          // once a user connects their own email we do not interfere with what they send in any way;
          // the only limit that remains is the 20/day anti-spam cap.
          if (data.tier === 'weak' && !data.ownInbox) {
            track('APPLY_DRAFT', { method: 'project', ok: false, reason: 'poor_match', opportunityId: project.id });
            setPhase('summary');
          } else generateCoverLetter();
        })
        .catch(() => { setPhase('summary'); });
      return;
    }

    // Normal auth check. A session can exist with NO résumé (re-login of an email-only account, or a
    // deferred profile) — so read the résumé + email here too, not just "is there a session". The apply
    // entry points gate on hasResume to keep a résumé-less user out of apply (ATS "You're all set" too).
    fetch('/api/user/settings', { method: 'GET', credentials: 'include' })
      .then(async r => {
        if (!r.ok) return;
        setIsAuthed(true);
        const d = await r.json().catch(() => null);
        setHasResume(d?.profile?.resumeUrl ? true : false);
        if (d?.profile?.email) setEmail(d.profile.email); // profile step submits the résumé by email
      })
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
  async function checkEmail(): Promise<{ exists: boolean; hasResume: boolean } | null> {
    if (!email || !email.includes('@') || !email.includes('.')) return null;
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
      return { exists: !!data.exists, hasResume: data.hasResume ?? false };
    } catch {
      setIsExisting(null);
      setHasResume(null);
      return null;
    } finally {
      setCheckingEmail(false);
    }
  }

  // Send OTP code
  async function handleSendCode() {
    if (!email || !email.includes('@')) return;
    setAuthLoading(true);
    setAuthError('');

    try {
      // Resolve whether this email exists / has a résumé HERE, on submit — not as a button gate. On
      // mobile the input stays focused (keyboard up), so the onBlur check often never fired, leaving
      // isExisting=null and the button dead. Now the button is enabled on a valid email and we run the
      // check at click time (using the returned value, since setState wouldn't be visible in-scope).
      let exists = isExisting;
      let hasRes = hasResume;
      if (exists === null) {
        const r = await checkEmail();
        if (!r) { setAuthError('Could not verify that email — please try again.'); setAuthLoading(false); return; }
        exists = r.exists; hasRes = r.hasResume;
      }
      // STEP 1 = EMAIL ONLY. No résumé/LinkedIn/category fields here — they're collected only
      // AFTER the user confirms the OTP code (see profileStep / handleProfileSubmit). Email
      // verification is the gate: an unconfirmed visitor never even sees the fields, and we
      // process nothing for them. Register the new user with email only and trigger the code.
      if (hasRes === false && exists === false) {
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
        // Defer the session for ANY résumé-less user, not just brand-new ones: re-login of an existing
        // email-only account (isExisting=true, no résumé) would otherwise get a live session with an
        // empty profile — the exact "authed but résumé-less" state that leaked into apply. flow='register'
        // makes verify-code withhold the session until resume-preauth saves the résumé.
        body: JSON.stringify({ email, code, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, flow: hasResume === false ? 'register' : undefined }),
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
    if (!resumeFile && !cvFromLinks) errors.resume = true;
    if (!linkedinUrl) errors.linkedin = true;
    if (!messenger.trim()) errors.messenger = true;
    if (!workAuth) errors.workAuth = true;
    if (!currentRate.trim()) errors.currentRate = true;
    if (!salaryExpectation.trim()) errors.salary = true;
    if (!noticeForm) errors.notice = true;
    if (!shareConsent) errors.consent = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setAuthError(errors.consent && Object.keys(errors).length === 1
        ? 'Please accept the Terms & Privacy Policy to continue'
        : 'Please fill in all required fields');
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
      if (resumeFile) fd.append('file', resumeFile);
      fd.append('email', email);
      fd.append('linkedinUrl', linkedinUrl);
      fd.append('messenger', messenger.trim());
      fd.append('githubUrl', githubUrlField.trim());
      if (cvFromLinks) { fd.append('buildFromLinks', 'true'); if (portfolioUrl.trim()) fd.append('portfolioUrl', portfolioUrl.trim()); }
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
      // 413 = Vercel body limit hit before our code ran (no JSON) — name the real cause.
      setAuthError(pre?.status === 413
        ? 'Your résumé file is too large (max 4 MB) — compress it or use “Build it from my links”.'
        : typeof (d as { error?: string }).error === 'string' ? (d as { error?: string }).error! : 'Could not save your profile — check your résumé and try again.');
      setFieldErrors({ resume: true });
      return; // form stays mounted → every field (incl. rate/salary) is preserved
    }

    // STAGE 2 — profile saved. The registration (the whole point for ATS opps) is done.
    setIsAuthed(true);
    setHasResume(true); // résumé now on file → apply entry points won't re-gate to the profile step
    setAuthLoading(false);
    // URL-apply (ATS) opportunity: no email to send — hand over the external link now.
    if (startExternalApply()) return;
    // NOW move to the processing screen and assess the match. If assessment itself fails we fail-open
    // to the write screen (the résumé is already saved).
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
      setOwnInbox(!!data.ownInbox);
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
      setSendTo(data.to || '');
      // Strong/Good → skip the preview, write the application straight away. The weak preview is
      // ONLY for users without their own inbox (owner rule 2026-07-11: own inbox = zero interference,
      // just the 20/day cap).
      if (data.tier === 'weak' && !data.ownInbox) setPhase('summary');
      else generateCoverLetter();
    } catch {
      setPhase('summary'); // fail-open: still let the user proceed to write the application
    }
  }

  // URL-apply opportunities (ATS/Lever) have no email — our cover-letter/email flow can't send them.
  // The value is the registration we just captured; from here we hand the candidate the working
  // external link. Returns true if it took over the flow (caller must not start the email path).
  function startExternalApply(): boolean {
    if (!project.externalApplyUrl) return false;
    track('FUNNEL_STEP', { step: 'ats_external_apply', opportunityId: project.id });
    setPhase('external');
    return true;
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
        setCoverage(data.coverage || null);
        setIsProPlan(!!data.pro);
        setPhase('review');
      } else {
        if (data.error === 'resume_required') {
          setGenError('Resume required. Please go back and upload your resume.');
          setPhase('auth');
        } else if (data.error === 'already_applied') {
          setGenError('You already applied to this project.');
          setPhase('sent');
        } else if (data.error === 'generation_limit') {
          // Free AI generation spent → review screen with the PRO pitch; manual writing + sending free.
          setGenPaywall(true);
          setCoverLetter('');
          setSubject(`Application: ${project.title}`);
          setSendTo(data.to || '');
          setGenError('');
          setPhase('review');
        } else if (data.error === 'smtp_required' || data.error === 'poor_match') {
          // Our-name (Postal) sending is reserved for the strongest matches; anything below the bar
          // routes to the honest gated summary with the "connect your email to send it yourself"
          // path (and, for a genuine poor match, better-matching roles).
          setMatchTier(data.reason === 'poor_match' || data.error === 'poor_match' ? 'weak' : 'good');
          setMatchLabel(data.matchLabel || 'Good');
          setGated(true);
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
              // A session can be résumé-less (re-login of an email-only account). Never let such a user
              // reach apply (ATS "You're all set" included) — route them to the profile step first.
              if (hasResume === false) { setPhase('auth'); setProfileStep(true); return; }
              if (startExternalApply()) return;
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
            No credit card · Free — 20 applications a day
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

            {/* Resume upload — OR build the CV from links (mobile no-file path) */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: fieldErrors.resume ? '#B91C1C' : '#555', display: 'block', marginBottom: '4px' }}>Resume (PDF) {!cvFromLinks && <span style={{ color: '#B91C1C' }}>*</span>}</label>
              {!cvFromLinks && (
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
                  // Vercel rejects bodies >4.5MB with an HTML 413 BEFORE our code runs — the user only saw
                  // a useless generic error. Catch the oversized file at the picker with a way out.
                  if (f && f.size > 4 * 1024 * 1024) { setAuthError('That PDF is over 4 MB — please compress it (e.g. ilovepdf.com/compress_pdf) or use “Build it from my links” below.'); setFieldErrors(p => ({ ...p, resume: true })); e.target.value = ''; return; }
                  setFieldErrors(p => { const n = { ...p }; delete n.resume; return n; }); setAuthError(''); setResumeFile(f || null);
                }} />
              </div>
              )}
              {cvFromLinks && (
                <div style={{ padding: '10px 14px', border: '1px solid #DDEBC4', borderRadius: '8px', fontSize: '12.5px', color: '#3F6212', background: '#F6FAEF', lineHeight: 1.5 }}>
                  ✓ We&apos;ll build your CV from your LinkedIn{githubUrlField ? ', GitHub' : ''}{portfolioUrl ? ' and portfolio' : ''} — you can replace it with your own file anytime.
                </div>
              )}
              <button type="button" onClick={() => { setCvFromLinks(v => !v); setFieldErrors(prev => { const n = { ...prev }; delete n.resume; return n; }); }} style={{ background: 'none', border: 'none', padding: 0, marginTop: '5px', fontSize: '12px', color: '#3F6212', textDecoration: 'underline', cursor: 'pointer' }}>
                {cvFromLinks ? '← I have a file — upload it instead' : 'No CV file on your phone? Build it from my links →'}
              </button>
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

            {/* WhatsApp / Telegram — reachability: recruiter replies get lost in email; LATAM lives in WhatsApp */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: fieldErrors.messenger ? '#B91C1C' : '#555', display: 'block', marginBottom: '4px' }}>WhatsApp or Telegram <span style={{ color: '#B91C1C' }}>*</span> <span style={{ color: '#9A958A', fontWeight: 400 }}>(so a recruiter reply never gets lost)</span></label>
              <input
                type="text" placeholder="+52 1 55 1234 5678 or @username" value={messenger}
                onChange={e => setMessenger(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${fieldErrors.messenger ? '#B91C1C' : '#D5D1C8'}`, borderRadius: '8px', fontSize: '13px' }}
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

            {cvFromLinks && (
              <div style={{ marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: '#555', display: 'block', marginBottom: '4px' }}>Portfolio / website <span style={{ color: '#9A958A', fontWeight: 400 }}>(optional — anywhere your work lives)</span></label>
                <input
                  type="url" placeholder="yoursite.com / behance.net/you / drive link" value={portfolioUrl}
                  onChange={e => setPortfolioUrl(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '13px' }}
                />
              </div>
            )}

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

            {/* REQUIRED: accept Terms + Privacy AND authorize sharing in one. Sharing IS the service (we
                apply and represent the candidate to employers), so it's part of what they agree to, not an
                optional add-on — a non-shareable registrant can't be served. */}
            <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '12px', color: fieldErrors.consent ? '#B91C1C' : '#555', cursor: 'pointer', lineHeight: 1.4, marginBottom: '10px' }}>
              <input type="checkbox" checked={shareConsent} onChange={e => { setShareConsent(e.target.checked); setFieldErrors(prev => ({ ...prev, consent: false })); }} style={{ marginTop: '2px', flexShrink: 0 }} />
              <span>I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#3F6212', textDecoration: 'underline' }}>Terms</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#3F6212', textDecoration: 'underline' }}>Privacy Policy</a>, and authorize Freelanly to apply to jobs and share my profile with employers and hiring partners on my behalf. <span style={{ color: '#B91C1C' }}>*</span></span>
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
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Sign in to apply</h2>

          {/* PRIMARY: one Google click = verified email + name + send-from-your-Gmail grant (3× replies,
              no OTP code that lands in spam). The callback returns here with ?gmail=connected and the
              mount effect routes straight to the profile step. */}
          <GoogleAuthButton returnPath={`${typeof window !== 'undefined' ? window.location.pathname : ''}?gmail=connected`} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '12px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E4E1D9' }} />
            <span style={{ fontSize: '12px', color: '#8A8780' }}>or continue with email</span>
            <div style={{ flex: 1, height: 1, background: '#E4E1D9' }} />
          </div>

          <input
            type="email" placeholder="you@email.com" value={email}
            onChange={e => { setEmail(e.target.value); setIsExisting(null); setHasResume(null); }}
            onBlur={checkEmail}
            onKeyDown={e => { if (e.key === 'Enter') handleSendCode(); }}
            autoFocus
            style={{ width: '100%', padding: '12px', border: '1px solid #D5D1C8', borderRadius: '8px', fontSize: '14px', marginBottom: '8px' }}
          />
          {checkingEmail && <div style={{ fontSize: '11px', color: '#8A8780', marginBottom: '8px' }}>Checking...</div>}

          {/* Fields (résumé/LinkedIn/work type) are intentionally NOT here — they appear only after
              the OTP code is confirmed (profileStep). Step 1 collects the email and nothing else. */}

          {authError && <div style={{ fontSize: '13px', color: '#B91C1C', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', marginBottom: '8px' }}>{authError}</div>}

          <button
            onClick={handleSendCode}
            disabled={authLoading || !email.includes('@')}
            style={{
              width: '100%', padding: '14px', background: '#C7F94A', color: '#000', border: 'none',
              borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginTop: '8px',
              opacity: authLoading || !email.includes('@') ? 0.6 : 1,
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
      // A Good (non-weak) match that's gated: it's a real fit we recommend, but our-name (Postal) sending
      // is reserved for the strongest, so this one is self-send only. The screen MUST be honest about that
      // — never promise "write your application" here (there's no our-name send button), or it reads as a
      // broken dead-end. It stays in the feed; we just tell the truth about how to send it.
      const gatedGood = !weak && gated;
      // Card palette by tier: green for a real fit, amber for "this one's a stretch".
      const cardBg = weak ? '#FFF8EC' : '#F6FAEF';
      const cardBorder = weak ? '#F2D9A8' : '#DDEBC4';
      const badgeColor = weak ? '#92400E' : '#3F6212';
      const badgeBg = weak ? '#FDE9C8' : '#D9F99D';

      // The self-send pitch, shown whenever this match is below our-name (Postal) bar: connect your own
      // inbox → apply to any match from their own address, we still write every letter and keep feeding you projects.
      // Shared by weak- AND good-gated (a Good match blocked by the wall must see it too, not loop on
      // "Write my application").
      const connectEmailBlock = (
        <div style={{ textAlign: 'center', margin: '4px 0 0', padding: '16px', background: '#F6FAEF', border: '1px solid #DDEBC4', borderRadius: '12px' }}>
          <p style={{ fontSize: '15px', color: '#1A1A17', margin: '0 0 6px', lineHeight: 1.45, fontWeight: 700 }}>
            {weak ? 'But you don’t have to stop here.' : 'Send this one yourself — from your own email.'}
          </p>
          <p style={{ fontSize: '13px', color: '#3F6212', margin: '0 0 14px', lineHeight: 1.55 }}>
            Connect your email and apply to <b>any match, anywhere</b> — sent from your own address, where replies land best.
            We write every cover letter for you and keep dropping fresh projects into your feed.
          </p>
          <button onClick={() => { track('FUNNEL_STEP', { step: 'smtp_prompt_click', surface: weak ? 'project_weak' : 'project_good', opportunityId: project.id }); setSmtpModal(true); }} style={{ display: 'inline-block', padding: '12px 22px', background: '#C7F94A', color: '#000', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            ✉️ Connect my email →
          </button>
        </div>
      );

      // Inbox already connected (Gmail OAuth / SMTP): pitching "Connect my email" again was the loop
      // that bounced users back through Google consent 2-3 times in a row. The real next action for
      // them is writing the letter — it sends from their own address, which the gate allows.
      const writeAnywayBlock = (
        <div style={{ textAlign: 'center', margin: '4px 0 0', padding: '16px', background: '#F6FAEF', border: '1px solid #DDEBC4', borderRadius: '12px' }}>
          <p style={{ fontSize: '15px', color: '#1A1A17', margin: '0 0 6px', lineHeight: 1.45, fontWeight: 700 }}>
            Your email is connected ✓
          </p>
          <p style={{ fontSize: '13px', color: '#3F6212', margin: '0 0 14px', lineHeight: 1.55 }}>
            We won’t send a below-bar match from our name — but you can. This application goes out from
            your own address, where replies land best.
          </p>
          <button onClick={() => { track('FUNNEL_STEP', { step: 'weak_write_anyway', opportunityId: project.id }); generateCoverLetter(); }} style={{ display: 'inline-block', padding: '12px 22px', background: '#C7F94A', color: '#000', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            ✍️ Write my application anyway →
          </button>
        </div>
      );

      return (
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
            {weak ? 'Honest take on this one' : gatedGood ? 'Good match ✓' : 'Here’s your match'}
          </h2>
          <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '14px' }}>
            {weak
              ? 'We read your résumé & LinkedIn — and we won’t send a mismatch on your behalf.'
              : gatedGood
              ? 'We read your résumé & LinkedIn — solid fit. From our name we send only your strongest matches, so send this one yourself, from your own inbox.'
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
            {/* Fallback when the AI summary didn't generate. Must NOT say "let's write your application"
                on a WEAK match — the whole screen is telling the user this ISN'T a strong fit, so the
                upbeat write-CTA contradicted itself (the "Weak match + let's write" clash). On weak we
                stay silent here (the honest paragraph below already explains it). */}
            {!matchSummary && !weak && <p style={{ fontSize: '13px', color: '#8A8780', margin: 0 }}>{gatedGood ? 'A good fit for your profile.' : 'Profile ready — let’s write your application.'}</p>}
          </div>

          {weak ? (
            <>
              <p style={{ fontSize: '13.5px', color: '#6B6862', lineHeight: 1.55, margin: '0 0 14px' }}>
                This isn&apos;t a <b>Strong</b> match, so we don&apos;t send it from our name — but you can send it
                yourself, from your own email. Or try one of the better-fitting roles below.
              </p>

              {/* Self-send path comes FIRST — it's the primary action for a below-bar match. Already-
                  connected users get the write button, NOT another connect pitch (Google-consent loop). */}
              <div style={{ marginBottom: '16px' }}>{ownInbox ? writeAnywayBlock : connectEmailBlock}</div>

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
            </>
          ) : gated && !ownInbox ? connectEmailBlock : (
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

          {/* Generation paywall (owner funnel 2026-07-12): free AI application spent → sell unlimited
              generation at the moment of peak intent. Sending stays free — the textarea below works. */}
          {genPaywall && (
            <div style={{ padding: '14px 16px', background: '#F6FAEF', border: '1px solid #DDEBC4', borderRadius: '12px', marginBottom: '14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1A1A17', marginBottom: '4px' }}>Your free AI application is used ✨</div>
              <div style={{ fontSize: '12.5px', color: '#3F6212', lineHeight: 1.5, marginBottom: '10px' }}>
                PRO writes the letter <b>and tailors your CV to every role</b> — unlimited, $5/month, cancel anytime.
                Or write this one yourself below — <b>sending is always free</b>.
              </div>
              <QueueUpgradeButton source="generation_paywall" label="Unlock unlimited AI applications →" />
            </div>
          )}

          {sendTo && (
            <div style={{ fontSize: '12px', color: '#8A8780', marginBottom: '8px', fontFamily: "'Geist Mono', monospace" }}>
              To: {sendTo}
            </div>
          )}

          {/* Visible proof of letter quality: deterministic requirements-coverage from matchBreakdown. */}
          {coverage && coverage.matched > 0 && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#F0FBE0', border: '1px solid #DDEBC4', borderRadius: '999px', fontSize: '12px', color: '#3F6212', fontWeight: 600, marginBottom: '10px', marginRight: '6px' }}>
              ✓ Covers {coverage.matched} of {coverage.total} job requirements
            </div>
          )}
          {/* Résumé attachment — recruiters' #1 ask; we DO attach it on every send, so say it for
              everyone (FREE saw no hint at all and hit Send blind). */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: '#F6FAEF', border: '1px solid #DDEBC4', borderRadius: '999px', fontSize: '12px', color: '#3F6212', fontWeight: 600, marginBottom: '10px' }}>
            {isProPlan ? '📎 CV tailored to this role — attached on send' : '📎 Your résumé is attached on send'}
          </div>

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

    // PHASE: EXTERNAL — URL-apply (ATS/Lever). We captured the registration; this role is applied to
    // on the company's own site, so hand over the working external link (no email flow).
    if (phase === 'external') {
      return (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: '48px', height: '48px', background: '#ECFDF5', borderRadius: '50%', display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>You&apos;re all set</h2>
          <p style={{ fontSize: '13.5px', color: '#6B6862', lineHeight: 1.55, margin: '0 auto 18px', maxWidth: '320px' }}>
            This role is hosted on the company&apos;s own site. Finish your application there — it opens in a new tab.
          </p>
          <a
            href={project.externalApplyUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('FUNNEL_STEP', { step: 'ats_external_open', opportunityId: project.id })}
            style={{ display: 'inline-block', width: '100%', boxSizing: 'border-box', padding: '14px', background: '#C7F94A', color: '#000', borderRadius: '10px', fontSize: '15px', fontWeight: 700, textDecoration: 'none' }}
          >
            Apply on company site ↗
          </a>
          <p style={{ fontSize: '12px', color: '#8A8780', margin: '16px 0 0' }}>
            We&apos;ll keep matching you to roles you can apply to right here — <a href="/dashboard/discovery" style={{ color: '#3F6212', fontWeight: 600 }}>see your feed →</a>
          </p>
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

          {/* Post-send data collection (expected rate / start date / portfolio) removed: the signup form
              now collects salary + rate + notice period (required) and GitHub, so these were duplicate
              re-asks for every fresh registrant. */}

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
      <SmtpConnectModal open={smtpModal} onClose={() => setSmtpModal(false)} initialEmail={email} />
      {/* Full-screen takeover for every "working" moment (profile setup + fit assessment + letter
          writing). The whole viewport is the process screen so attention can't scatter over the form
          or the job post — a real problem on mobile where the inline card was lost in the page. The
          form stays MOUNTED underneath (no re-mount reset); this just covers it opaquely. */}
      {isMobile && ((authLoading && profileStep) || phase === 'analyzing' || phase === 'generating') && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#FAFAF7', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ width: '100%', maxWidth: 440 }}>
            <ProcessingScreen steps={phase === 'generating' ? GEN_STEPS : ANALYZE_STEPS} emoji={phase === 'generating' ? '✍️' : '🔍'} />
          </div>
        </div>
      )}
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
