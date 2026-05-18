'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { categories, countries, languages } from '@/config/site';
import { getStoredClickId, getStoredUtmSource, getStoredUtmParams } from '@/components/analytics/GclidCapture';

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

type FormStep = 'email' | 'login' | 'register' | 'sent';

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
      if (step === 'register' || (step === 'email' && isExistingUser === false)) {
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

  // Debounced email check on typing
  useEffect(() => {
    if (!email || !email.includes('@') || !email.includes('.')) {
      setIsExistingUser(null);
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
    } catch {
      setIsExistingUser(null);
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

    // New user — validate categories
    if (isExistingUser === false) {
      if (selectedCategories.length === 0) {
        setError('Please select at least one job category');
        return;
      }
      if (showTranslationFields && selectedLanguages.length === 0) {
        setError('Please select at least one language for translation alerts');
        return;
      }
    }

    setIsLoading(true);
    setError('');

    try {
      // New user: register first
      if (isExistingUser === false) {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: name || undefined,
            categories: selectedCategories,
            languages: showTranslationFields ? selectedLanguages : undefined,
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

        // Upload resume or LinkedIn profile (non-blocking, pre-auth)
        if (resumeFile) {
          try {
            const formData = new FormData();
            formData.append('file', resumeFile);
            formData.append('email', email);
            if (linkedinUrl) formData.append('linkedinUrl', linkedinUrl);
            await fetch('/api/user/resume-preauth', { method: 'POST', body: formData }).catch(() => {});
          } catch {}
        } else if (linkedinUrl) {
          try {
            await fetch('/api/user/resume-preauth', {
              method: 'POST',
              body: (() => { const fd = new FormData(); fd.append('email', email); fd.append('linkedinUrl', linkedinUrl); return fd; })(),
            }).catch(() => {});
          } catch {}
        }
      }

      // Send magic link
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard/auto-apply',
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

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setIsLoading(true);

    // For new users, save registration data
    if (step === 'register' && selectedCategories.length > 0) {
      sessionStorage.setItem(
        'pendingRegistration',
        JSON.stringify({
          name,
          categories: selectedCategories,
          countries: selectedCountries,
          languages: showTranslationFields ? selectedLanguages : [],
        })
      );
    }

    await signIn('google', { callbackUrl: callbackUrl || '/dashboard/auto-apply' });
  };

  // Magic Link Sign In (for existing users)
  const handleMagicLinkLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard/auto-apply',
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
          await fetch('/api/user/resume-preauth', { method: 'POST', body: fd }).catch(() => {});
        } catch {}
      }

      // Send magic link
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard/auto-apply',
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
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        window.location.href = callbackUrl || data.callbackUrl || '/dashboard/auto-apply';
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
            maxLength={6}
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

        {/* Registration fields — only for NEW users */}
        {isExistingUser === false && (
          <>
            {/* Name */}
            <div>
              <label className="field-label">Your name</label>
              <input className="text-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" required />
            </div>

            {/* LinkedIn URL */}
            <div>
              <label className="field-label">LinkedIn URL <span className="optional">— optional, used as a credibility signal</span></label>
              <input className="text-input" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/yourname" />
            </div>

            {/* Resume Upload */}
            <div>
              <label className="field-label">Résumé</label>
              <label className="upload-zone" onClick={(e) => { const inp = (e.currentTarget as HTMLElement).querySelector('input[type="file"]') as HTMLInputElement; if (inp && (e.target as HTMLElement).tagName !== 'INPUT') inp.click(); }}>
                <div className="up-ico">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                </div>
                <div style={{flex: 1}}>
                  <div className="up-ttl">{resumeFile ? resumeFile.name : 'Upload your résumé'}</div>
                  <div className="up-sub">{resumeFile ? 'Ready to upload' : 'PDF or DOCX · we extract skills, roles, links'}</div>
                </div>
                <input type="file" accept=".pdf,.docx" style={{display: 'none'}} onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
                <span style={{fontSize: '11.5px', color: '#5C6068', fontFamily: "'Geist Mono', monospace"}}>Choose →</span>
              </label>
            </div>

            {/* Categories */}
            <div>
              <label className="field-label">What kind of work do you want? <span className="optional">— pick all that apply</span></label>
              <div className="cat-grid">
                {categories.slice(0, 8).map((cat) => (
                  <div key={cat.slug} className={`cat-chip${selectedCategories.includes(cat.slug) ? ' on' : ''}`} onClick={() => toggleCategory(cat.slug)}>
                    <span className="cb"></span>
                    {cat.name}
                  </div>
                ))}
              </div>
            </div>

            {/* Job Count Preview */}
            {selectedCategories.length > 0 && jobCountPreview && (
              <div style={{padding: '10px 14px', borderRadius: '10px', fontSize: '13px', background: jobCountPreview.count < 5 ? 'rgba(180,83,9,0.06)' : 'rgba(21,128,61,0.06)', border: `1px solid ${jobCountPreview.count < 5 ? 'rgba(180,83,9,0.2)' : 'rgba(21,128,61,0.2)'}`, color: jobCountPreview.count < 5 ? '#B45309' : '#15803D'}}>
                {jobCountPreview.count} jobs in the last 7 days (~{jobCountPreview.dailyAverage}/day)
              </div>
            )}

            {/* Translation Languages */}
            {showTranslationFields && (
              <div style={{padding: '12px', background: 'rgba(11,12,15,0.03)', borderRadius: '10px'}}>
                <label className="field-label">Your Languages *</label>
                <p style={{fontSize: '12px', color: '#5C6068', marginBottom: '8px'}}>Select languages you can translate (besides English)</p>
                <div className="cat-grid">
                  {languages.filter(l => l.code !== 'EN').slice(0, 12).map((lang) => (
                    <div key={lang.code} className={`cat-chip${selectedLanguages.includes(lang.code) ? ' on' : ''}`} onClick={() => toggleLanguage(lang.code)}>
                      <span className="cb"></span>
                      {lang.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {error && <p style={{fontSize: '13px', color: '#B91C1C'}}>{error}</p>}

        <button
          className="primary-btn"
          onClick={handleSendMagicLink}
          disabled={isLoading || isExistingUser === null || (isExistingUser === false && (selectedCategories.length === 0 || !name.trim()))}
        >
          {isLoading ? 'Sending...' : isExistingUser ? 'Send me a code' : 'Send me a code'}
          <span style={{transition: 'transform 140ms'}}>→</span>
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
            {categories.slice(0, 8).map((cat) => (
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
