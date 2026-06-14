'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { categories, countries, languages } from '@/config/site';
import { getStoredClickId, getStoredUtmSource, getStoredUtmParams } from '@/components/analytics/GclidCapture';
import { SalaryPicker } from '@/components/SalaryPicker';
import { ProcessingScreen, PROFILE_BUILD_STEPS } from '@/components/ProcessingScreen';

/** Read UTM params from current page URL as fallback when localStorage is empty */
function getUtmFromUrl(): { source?: string; utmMedium?: string; utmCampaign?: string; utmContent?: string; gclid?: string } {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const result: Record<string, string> = {};
  const source = params.get('utm_source');
  if (source) result.source = source;
  const medium = params.get('utm_medium');
  if (medium) result.utmMedium = medium;
  const campaign = params.get('utm_campaign');
  if (campaign) result.utmCampaign = campaign;
  const content = params.get('utm_content');
  if (content) result.utmContent = content;
  const gclid = params.get('gclid');
  if (gclid) result.gclid = gclid;
  // Also check referrer for source hints
  if (!result.source && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.hostname.includes('mail.google') || ref.hostname.includes('outlook.live') || ref.hostname.includes('outlook.office') || ref.hostname.includes('mail.yahoo') || ref.hostname.includes('mail.aol') || ref.hostname.includes('protonmail')) result.source = 'email';
      else if (ref.hostname.includes('google')) result.source = 'google_organic';
      else if (ref.hostname.includes('linkedin')) result.source = 'linkedin';
      else if (ref.hostname.includes('facebook') || ref.hostname.includes('fb.')) result.source = 'facebook';
      else if (ref.hostname.includes('twitter') || ref.hostname.includes('x.com')) result.source = 'twitter';
      else if (ref.hostname.includes('t.me') || ref.hostname.includes('telegram')) result.source = 'telegram';
      else if (ref.hostname.includes('chatgpt') || ref.hostname.includes('openai')) result.source = 'chatgpt';
      else if (!ref.hostname.includes('freelanly')) result.source = ref.hostname;
    } catch {}
  }
  return result;
}
import { useTracker } from '@/hooks/useTracker';

interface JobCountPreview {
  count: number;
  countWithoutCountry: number;
  dailyAverage: number;
}

export interface RegistrationFormProps {
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  callbackUrl?: string;
  onEmailSent?: (email: string) => void;
  showJobContext?: boolean;
  prefillEmail?: string;
}

type FormStep = 'email' | 'login' | 'register' | 'sent' | 'profile';

interface UserInfo {
  name: string | null;
  isVerified: boolean;
}

export function RegistrationForm({
  jobId,
  jobTitle,
  companyName,
  callbackUrl,
  onEmailSent,
  showJobContext = false,
  prefillEmail,
}: RegistrationFormProps) {
  const { track: trackDb } = useTracker();

  // Form step
  const [step, setStep] = useState<FormStep>('email');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Form fields
  const [email, setEmail] = useState(prefillEmail || '');
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [salaryExpectation, setSalaryExpectation] = useState('');
  const [tgState, setTgState] = useState<'idle' | 'opening' | 'opened'>('idle');
  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState<boolean | null>(null); // null = not checked yet
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [error, setError] = useState('');

  // Job count preview
  const [jobCountPreview, setJobCountPreview] = useState<JobCountPreview | null>(null);
  const [isLoadingJobCount, setIsLoadingJobCount] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Country handlers
  const toggleCountry = (code: string) => {
    setSelectedCountries((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const removeCountry = (code: string) => {
    setSelectedCountries((prev) => prev.filter((c) => c !== code));
  };

  // Fetch job count preview when filters change
  const fetchJobCount = useCallback(async () => {
    if (selectedCategories.length === 0) {
      setJobCountPreview(null);
      return;
    }

    setIsLoadingJobCount(true);
    try {
      const counts = await Promise.all(
        selectedCategories.map(async (category) => {
          const params = new URLSearchParams({ category, days: '7' });
          // For translation category, filter by selected languages
          if (category === 'translation' && selectedLanguages.length > 0) {
            params.set('languages', selectedLanguages.join(','));
          }
          const res = await fetch(`/api/jobs/count?${params}`);
          return res.json();
        })
      );

      const totalCount = counts.reduce((sum, c) => sum + (c.count || 0), 0);
      const avgDaily = counts.reduce((sum, c) => sum + (c.dailyAverage || 0), 0);

      setJobCountPreview({
        count: totalCount,
        countWithoutCountry: totalCount,
        dailyAverage: Math.round(avgDaily * 10) / 10,
      });
    } catch (err) {
      console.error('Failed to fetch job count:', err);
      setJobCountPreview(null);
    } finally {
      setIsLoadingJobCount(false);
    }
  }, [selectedCategories, selectedLanguages]);

  // Debounced fetch on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'register' || (step === 'email' && hasResume === false)) {
        fetchJobCount();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategories, selectedLanguages, step, isExistingUser, fetchJobCount]);

  // Track signup start when user begins entering email
  const signupStartTracked = useRef(false);
  useEffect(() => {
    if (email && email.includes('@') && !signupStartTracked.current) {
      signupStartTracked.current = true;
      trackDb('SIGNUP_START', { source: jobId ? 'job_page' : 'direct', jobId });
    }
  }, [email, jobId, trackDb]);

  // Has resume flag from check-email API
  const [hasResume, setHasResume] = useState<boolean | null>(null);

  // Debounced email check on typing
  useEffect(() => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setIsExistingUser(null);
      setHasResume(null);
      return;
    }
    const timer = setTimeout(() => {
      checkEmailExists(email);
    }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const showTranslationFields = selectedCategories.includes('translation');

  // Check email on blur — determines if user exists
  const checkEmailExists = async (emailToCheck: string) => {
    if (!emailToCheck || !emailToCheck.includes('@')) return;

    setIsCheckingEmail(true);
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      });
      const data = await res.json();
      setIsExistingUser(data.exists);
      setHasResume(data.hasResume ?? false);
    } catch {
      setIsExistingUser(null);
      setHasResume(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  // Send magic link (existing user) or register + send (new user)
  const handleSendMagicLink = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    // Normalize email to prevent case mismatch with OTP token lookup
    setEmail(prev => prev.toLowerCase().trim());

    setIsLoading(true);
    setError('');

    try {
      // EMAIL-FIRST: register the new user with email ONLY. Résumé / LinkedIn / categories / salary
      // are collected AFTER the OTP code is confirmed (the 'profile' step) — same mechanic as the
      // inline apply flow. Categories only fed suspended job-alerts and the loop derives its own
      // from the résumé, so an empty list here is fine. Existing users skip register entirely.
      if (hasResume === false && isExistingUser === false) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: name || undefined,
            categories: [],
            jobId,
            agreedToTerms: true,
            gclid: getStoredClickId()?.value || getUtmFromUrl().gclid,
            source: getStoredUtmSource() || getUtmFromUrl().source || undefined,
            ...{ ...getUtmFromUrl(), ...getStoredUtmParams() },
          }),
        });
        if (!regRes.ok) {
          const data = await regRes.json();
          throw new Error(data.error || 'Registration failed');
        }
      }

      // Send magic link
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard',
        redirect: false,
      });

      if (result?.ok) {
        setStep('sent');
        onEmailSent?.(email);
        // Track signup complete for new users
        if (isExistingUser === false) {
          trackDb('SIGNUP_COMPLETE', { source: jobId ? 'job_page' : 'direct', categories: selectedCategories });
        }
        // Track signup conversion in Google Ads (new users only)
        if (isExistingUser === false && typeof window !== 'undefined' && (window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            send_to: `${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}/${process.env.NEXT_PUBLIC_GADS_CONV_SIGNUP}`,
          });
        }
      } else {
        throw new Error('Failed to send magic link');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isExistingUser !== null) {
        handleSendMagicLink();
      }
    }
  };

  const goBack = () => {
    setStep('email');
    setUserInfo(null);
    setError('');
  };

  // Open the Telegram deep link for instant recruiter-reply alerts. Auth-gated → only the
  // post-code 'profile' step. Linking completes when the user taps Start (bot sets telegramChatId).
  async function connectTelegram() {
    setTgState('opening');
    try {
      const r = await fetch('/api/user/telegram-link', { method: 'POST' });
      const d = await r.json();
      if (d.url) { window.open(d.url, '_blank'); setTgState('opened'); } else setTgState('idle');
    } catch { setTgState('idle'); }
  }

  // STEP 3 ('profile', only after the OTP code is confirmed): collect résumé/LinkedIn/categories/
  // salary, build the profile, then enter the account. Mirror of the inline apply flow — the only
  // difference is the final action (here: go to the dashboard; inline: generate + send the apply).
  async function handleProfileSubmit() {
    if (!resumeFile) { setError('Please upload your résumé (PDF)'); return; }
    if (!linkedinUrl) { setError('Please add your LinkedIn profile URL'); return; }
    if (selectedCategories.length === 0) { setError('Please pick at least one kind of work'); return; }
    if (showTranslationFields && selectedLanguages.length === 0) { setError('Please pick at least one language'); return; }
    setError('');
    setProfileSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', resumeFile);
      fd.append('email', email);
      fd.append('linkedinUrl', linkedinUrl);
      if (salaryExpectation.trim()) fd.append('salaryExpectation', salaryExpectation.trim());
      try { await fetch('/api/user/resume-preauth', { method: 'POST', body: fd }); } catch { /* dashboard handles a missing profile */ }
      window.location.href = callbackUrl || '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setProfileSubmitting(false);
    }
  }

  // Category handlers
  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) => {
      const isRemoving = prev.includes(slug);
      if (isRemoving) {
        // Clear languages when removing translation
        if (slug === 'translation') {
          setSelectedLanguages([]);
        }
        return prev.filter((c) => c !== slug);
      } else {
        return [...prev, slug];
      }
    });
  };

  const removeCategory = (slug: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== slug));
    if (slug === 'translation') {
      setSelectedLanguages([]);
    }
  };

  // Language handlers
  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const removeLanguage = (code: string) => {
    setSelectedLanguages((prev) => prev.filter((l) => l !== code));
  };

  // Magic Link Sign In (for existing users)
  const handleMagicLinkLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard',
        redirect: false,
      });

      if (result?.ok) {
        setStep('sent');
        onEmailSent?.(email);
      } else {
        throw new Error('Failed to send magic link');
      }
    } catch {
      setError('Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Registration Submit (for new users)
  const handleRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCategories.length === 0) {
      setError('Please select at least one job category');
      return;
    }

    // Validate languages for translation category
    if (showTranslationFields && selectedLanguages.length === 0) {
      setError('Please select at least one language for translation alerts');
      return;
    }

    // Validate ToS agreement
    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service and Privacy Policy');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Register user and create alerts
      const regResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          categories: selectedCategories,
          countries: selectedCountries.length > 0 ? selectedCountries : undefined,
          languages: showTranslationFields ? selectedLanguages : undefined,
          jobId,
          agreedToTerms: true, // User explicitly agreed via checkbox
          gclid: getStoredClickId()?.value || getUtmFromUrl().gclid,
          source: getStoredUtmSource() || getUtmFromUrl().source || undefined,
          ...{ ...getUtmFromUrl(), ...getStoredUtmParams() },
        }),
      });

      if (!regResponse.ok) {
        const data = await regResponse.json();
        throw new Error(data.error || 'Registration failed');
      }

      // Upload resume/LinkedIn if provided (non-blocking, pre-auth)
      if (resumeFile || linkedinUrl) {
        try {
          const fd = new FormData();
          if (resumeFile) fd.append('file', resumeFile);
          fd.append('email', email);
          if (linkedinUrl) fd.append('linkedinUrl', linkedinUrl);
          if (salaryExpectation.trim()) fd.append('salaryExpectation', salaryExpectation.trim());
          await fetch('/api/user/resume-preauth', { method: 'POST', body: fd }).catch(() => {});
        } catch {}
      }

      // Send magic link
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard',
        redirect: false,
      });

      if (result?.ok) {
        setStep('sent');
        onEmailSent?.(email);
        trackDb('SIGNUP_COMPLETE', { source: 'registration_form', categories: selectedCategories });
      } else {
        throw new Error('Failed to send magic link');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // OTP code state
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');

    // iOS AutoFill pastes full code into one field
    if (digits.length > 1) {
      const newCode = digits.slice(0, 6).split('');
      while (newCode.length < 6) newCode.push('');
      setOtpCode(newCode);
      setOtpError('');
      if (newCode.length === 6 && newCode.every(d => d)) {
        otpRefs.current[5]?.focus();
        submitOtp(newCode.join(''));
      }
      return;
    }

    const digit = digits.slice(-1);
    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);
    setOtpError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) submitOtp(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpCode(pasted.split(''));
      otpRefs.current[5]?.focus();
      submitOtp(pasted);
    }
  };

  const submitOtp = async (fullCode: string) => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Email confirmed. Users who still need a profile go to the 'profile' step (collect
        // résumé/LinkedIn/categories/salary/Telegram, then apply); everyone else (existing user
        // with a résumé) just enters their account.
        if (hasResume === false) { setStep('profile'); setOtpLoading(false); return; }
        window.location.href = callbackUrl || data.callbackUrl || '/dashboard';
      } else {
        setOtpError(data.error || 'Invalid code');
        setOtpCode(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Step: Email Sent — show code input
  if (step === 'sent') {
    return (
      <div style={{textAlign: 'center', padding: '16px 0'}}>
        <div style={{width: '64px', height: '64px', background: 'rgba(199,249,74,0.2)', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'}}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4D8B0A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
        </div>
        <h2 style={{fontSize: '20px', fontWeight: 600, marginBottom: '8px'}}>Enter the code</h2>
        <p style={{color: '#5C6068', marginBottom: '24px'}}>
          We sent a 6-digit code to<br/>
          <span style={{fontWeight: 500, color: '#0A0B0F'}}>{email}</span>
        </p>

        <div style={{position: 'relative', display: 'flex', justifyContent: 'center', marginBottom: '16px'}}>
          <input
            ref={(el) => { otpRefs.current[0] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otpCode.join('')}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
              const newCode = digits.split('');
              while (newCode.length < 6) newCode.push('');
              setOtpCode(newCode);
              setOtpError('');
              if (digits.length === 6) submitOtp(digits);
            }}
            onPaste={handleOtpPaste}
            disabled={otpLoading}
            autoFocus
            style={{position: 'absolute', inset: 0, width: '100%', opacity: 0, zIndex: 10, cursor: 'pointer', caretColor: 'transparent'}}
          />
          <div style={{display: 'flex', gap: '8px', pointerEvents: 'none'}}>
            {otpCode.map((digit, index) => (
              <div
                key={index}
                style={{
                  width: '44px', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: 700, border: `2px solid ${otpError ? '#B91C1C' : digit ? '#0A0B0F' : 'rgba(11,12,15,0.12)'}`,
                  borderRadius: '10px', transition: 'border-color 140ms', opacity: otpLoading ? 0.5 : 1,
                }}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
        {otpError && <p style={{fontSize: '13px', color: '#B91C1C', marginBottom: '12px'}}>{otpError}</p>}
        {otpLoading && <p style={{fontSize: '13px', color: '#5C6068', marginBottom: '12px'}}>Verifying...</p>}

        {/* Biggest drop-off in the funnel is right here: cold Gmail can file the code under
            Spam/Promotions. Nudging those folders + a one-click resend recovers users who'd
            otherwise assume nothing arrived. */}
        <p style={{fontSize: '13px', color: '#5C6068', marginBottom: '8px', lineHeight: 1.5}}>
          Didn&apos;t get it? Check <b>Spam</b> or <b>Promotions</b>.{' '}
          <button onClick={() => { setOtpCode(['','','','','','']); setOtpError(''); handleSendMagicLink(); }} disabled={otpLoading} style={{color: '#4D8B0A', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, textDecoration: 'underline'}}>
            Resend code
          </button>
        </p>
        <p style={{fontSize: '12px', color: '#6B7280', marginBottom: '16px'}}>or click the link in the email</p>

        <button
          onClick={() => { setStep('email'); setEmail(''); setUserInfo(null); setOtpCode(['','','','','','']); setOtpError(''); }}
          style={{fontSize: '13px', color: '#5C6068', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer'}}
        >
          Use a different email
        </button>
      </div>
    );
  }

  // Step: Email Input (+ registration fields for new users)
  if (step === 'email') {
    return (
      <div className="field-group">
        {/* Email only — no Google OAuth */}

        {/* Job context */}
        {showJobContext && jobTitle && companyName && (
          <div style={{padding: '10px 14px', background: 'rgba(199,249,74,0.1)', border: '1px solid rgba(199,249,74,0.3)', borderRadius: '10px', textAlign: 'center', fontSize: '13px'}}>
            Apply to <strong>{jobTitle}</strong> at <strong>{companyName}</strong>
          </div>
        )}

        {/* Email Input */}
        <div>
          <label className="field-label">Work email</label>
          <input
            className="text-input"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setIsExistingUser(null); }}
            onBlur={() => checkEmailExists(email)}
            onKeyDown={handleEmailKeyDown}
            placeholder="you@inbox.com"
            autoFocus
          />
          <div className="helper">We&apos;ll send a 6-digit code · <b>no password to remember</b></div>
          {isCheckingEmail && (
            <p style={{marginTop: '4px', fontSize: '12px', color: '#5C6068'}}>Checking...</p>
          )}
        </div>

        {/* Profile fields (résumé/LinkedIn/categories/salary/Telegram) are collected on the
            post-code 'profile' step — this email-first step asks ONLY for the email. */}

        {error && <p style={{fontSize: '13px', color: '#B91C1C'}}>{error}</p>}

        <button
          className="primary-btn"
          onClick={handleSendMagicLink}
          disabled={isLoading || isExistingUser === null}
        >
          {isLoading ? 'Sending...' : isExistingUser ? 'Send me a code' : 'Send me a code'}
          <span style={{transition: 'transform 140ms'}}>→</span>
        </button>

      </div>
    );
  }

  // Step: Profile — reached ONLY after the OTP code is confirmed (email-first). Collects the
  // résumé/LinkedIn/categories/salary + optional Telegram, then enters the account.
  if (step === 'profile') {
    // While the profile is being built (résumé upload + LinkedIn scrape + AI parse, 10-35s),
    // show the live processing screen instead of a frozen "Setting up…" button.
    if (profileSubmitting) return <ProcessingScreen steps={PROFILE_BUILD_STEPS} emoji="📋" />;
    return (
      <div className="field-group">
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Email confirmed ✓</h2>
          <p style={{ marginTop: '4px', color: '#5C6068', fontSize: '13px' }}>Now tell us about you so we can apply.</p>
        </div>

        {/* LinkedIn URL */}
        <div>
          <label className="field-label">LinkedIn URL <span className="required" style={{ color: '#B91C1C' }}>*</span></label>
          <input className="text-input" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/yourname" />
        </div>

        {/* Résumé */}
        <div>
          <label className="field-label">Résumé (PDF) <span className="required" style={{ color: '#B91C1C' }}>*</span></label>
          <div
            className={`upload-zone${resumeFile ? ' has-file' : ''}`}
            onClick={(e) => { const inp = (e.currentTarget as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement; if (inp && (e.target as HTMLElement).tagName !== 'INPUT') inp.click(); }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('drag-over'); }}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); const file = e.dataTransfer.files?.[0]; if (file && (file.name.endsWith('.pdf') || file.name.endsWith('.docx'))) setResumeFile(file); }}
          >
            <div style={{ flex: 1 }}>
              <div className="up-ttl">{resumeFile ? resumeFile.name : 'Drag & drop your résumé here'}</div>
              <div className="up-sub">{resumeFile ? 'Ready to upload' : 'PDF or DOCX · or click to choose'}</div>
            </div>
            <input type="file" accept=".pdf,.docx" style={{ display: 'none' }} onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
            {resumeFile ? <span style={{ fontSize: '11.5px', color: '#047857' }}>✓</span> : <span style={{ fontSize: '11.5px', color: '#5C6068' }}>Choose →</span>}
          </div>
        </div>

        {/* Categories */}
        <div>
          <label className="field-label">What kind of work? <span className="required" style={{ color: '#B91C1C' }}>*</span></label>
          <div className="cat-grid">
            {categories.map((cat) => (
              <div key={cat.slug} className={`cat-chip${selectedCategories.includes(cat.slug) ? ' on' : ''}`} onClick={() => toggleCategory(cat.slug)}>
                <span className="cb"></span>{cat.name}
              </div>
            ))}
          </div>
        </div>

        {showTranslationFields && (
          <div style={{ padding: '12px', background: 'rgba(11,12,15,0.03)', borderRadius: '10px' }}>
            <label className="field-label">Your Languages *</label>
            <div className="cat-grid" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {languages.filter(l => l.code !== 'EN').map((lang) => (
                <div key={lang.code} className={`cat-chip${selectedLanguages.includes(lang.code) ? ' on' : ''}`} onClick={() => toggleLanguage(lang.code)}>
                  <span className="cb"></span>{lang.name}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Desired salary — optional */}
        <div>
          <label className="field-label">Desired salary <span className="optional">— optional, so recruiters don&apos;t have to ask</span></label>
          <SalaryPicker onChange={setSalaryExpectation} />
        </div>

        {/* Telegram reply alerts — optional */}
        <div>
          <label className="field-label">Get recruiter-reply alerts on Telegram <span className="optional">— optional</span></label>
          <button
            type="button" onClick={connectTelegram} disabled={tgState === 'opening'}
            style={{ width: '100%', padding: '10px 12px', background: tgState === 'opened' ? '#ECFDF5' : '#fff', color: tgState === 'opened' ? '#047857' : '#229ED9', border: `1px solid ${tgState === 'opened' ? '#A7F3D0' : '#229ED9'}`, borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >
            {tgState === 'opened' ? '✓ Telegram opened — tap Start in the bot' : tgState === 'opening' ? 'Opening…' : '✈ Connect Telegram for instant alerts'}
          </button>
        </div>

        {error && <p style={{ fontSize: '13px', color: '#B91C1C' }}>{error}</p>}

        <button className="primary-btn" onClick={handleProfileSubmit} disabled={profileSubmitting}>
          {profileSubmitting ? 'Setting up your profile…' : 'Continue →'}
        </button>
      </div>
    );
  }

  // Step: Login (existing user)
  if (step === 'login') {
    const displayName = userInfo?.name?.split(' ')[0] || 'there';

    return (
      <div className="field-group">
        <button onClick={goBack} style={{fontSize: '13px', color: '#5C6068', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'}}>
          ← Back
        </button>

        <div style={{textAlign: 'center'}}>
          <h2 style={{fontSize: '20px', fontWeight: 600}}>Welcome back, {displayName}!</h2>
          <p style={{marginTop: '4px', color: '#5C6068'}}>{email}</p>
        </div>

        {error && <p style={{fontSize: '13px', color: '#B91C1C'}}>{error}</p>}

        <button className="primary-btn" onClick={handleMagicLinkLogin} disabled={isLoading}>
          {isLoading ? 'Sending...' : 'Send me a code →'}
        </button>

        <p style={{textAlign: 'center', fontSize: '12px', color: '#6B7280'}}>
          We&apos;ll email you a code to sign in instantly.
        </p>
      </div>
    );
  }

  // Step: Register (new user) — fallback, should not normally reach here
  // since the email step now handles both new and existing users
  return (
    <div className="field-group">
      <button onClick={goBack} style={{fontSize: '13px', color: '#5C6068', background: 'none', border: 'none', cursor: 'pointer'}}>← Back</button>
      <div style={{textAlign: 'center'}}>
        <h2 style={{fontSize: '20px', fontWeight: 600}}>Create your account</h2>
        <p style={{color: '#5C6068'}}>{email}</p>
      </div>

      <form onSubmit={handleRegistrationSubmit} className="field-group">
        <div>
          <label className="field-label">Name</label>
          <input className="text-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        </div>

        <div>
          <label className="field-label">What kind of work? <span className="optional">— pick all that apply</span></label>
          <div className="cat-grid">
            {categories.map((cat) => (
              <div key={cat.slug} className={`cat-chip${selectedCategories.includes(cat.slug) ? ' on' : ''}`} onClick={() => toggleCategory(cat.slug)}>
                <span className="cb"></span>{cat.name}
              </div>
            ))}
          </div>
        </div>

        {error && <p style={{fontSize: '13px', color: '#B91C1C'}}>{error}</p>}

        <button className="primary-btn" type="submit" disabled={isLoading || !agreedToTerms}>
          {isLoading ? 'Creating account...' : 'Get Started Free →'}
        </button>
      </form>
    </div>
  );
}
