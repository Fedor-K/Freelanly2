'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categories, countries, languages } from '@/config/site';
import { Mail, ChevronDown, Check, X, Zap, ArrowLeft, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';
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
}: RegistrationFormProps) {
  const { track: trackDb } = useTracker();

  // Form step
  const [step, setStep] = useState<FormStep>('email');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

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

        // Upload resume if provided (non-blocking, pre-auth)
        if (resumeFile) {
          try {
            const formData = new FormData();
            formData.append('file', resumeFile);
            formData.append('email', email);
            await fetch('/api/user/resume-preauth', { method: 'POST', body: formData }).catch(() => {});
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

      // Upload resume if provided (non-blocking, pre-auth)
      if (resumeFile) {
        try {
          const formData = new FormData();
          formData.append('file', resumeFile);
          formData.append('email', email);
          await fetch('/api/user/resume-preauth', { method: 'POST', body: formData }).catch(() => {});
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
      <div className="text-center py-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Enter the code</h2>
        <p className="text-muted-foreground mb-6">
          We sent a 6-digit code to
          <br />
          <span className="font-medium text-foreground">{email}</span>
        </p>

        {/* Code input — single input styled as 6 boxes for iOS AutoFill */}
        <div className="relative flex justify-center mb-4">
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
            className="absolute inset-0 w-full opacity-0 z-10 cursor-pointer"
            style={{ caretColor: 'transparent' }}
          />
          <div className="flex gap-2 pointer-events-none">
            {otpCode.map((digit, index) => (
              <div
                key={index}
                className={`w-11 h-13 flex items-center justify-center text-2xl font-bold border-2 rounded-lg transition-colors ${
                  otpError ? 'border-destructive' : digit ? 'border-primary' : 'border-input'
                } ${otpLoading ? 'opacity-50' : ''}`}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
        {otpError && <p className="text-sm text-destructive mb-3">{otpError}</p>}
        {otpLoading && <p className="text-sm text-muted-foreground mb-3">Verifying...</p>}

        <p className="text-xs text-muted-foreground mb-4">
          or click the link in the email
        </p>

        <button
          onClick={() => {
            setStep('email');
            setEmail('');
            setUserInfo(null);
            setOtpCode(['', '', '', '', '', '']);
            setOtpError('');
          }}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  // Step: Email Input (+ registration fields for new users)
  if (step === 'email') {
    return (
      <div className="space-y-4">
        {/* Job context */}
        {showJobContext && jobTitle && companyName && (
          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
            Apply to <strong>{jobTitle}</strong> at <strong>{companyName}</strong>
          </div>
        )}

        {/* Email Input */}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setIsExistingUser(null); // reset on change
            }}
            onBlur={() => checkEmailExists(email)}
            onKeyDown={handleEmailKeyDown}
            placeholder="your@email.com"
            className="mt-1"
            autoFocus
          />
          {isCheckingEmail && (
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Checking...
            </p>
          )}
        </div>

        {/* Registration fields — only for NEW users */}
        {isExistingUser === false && (
          <>
            {/* Categories Multi-select */}
            <div>
              <Label>What roles interest you? *</Label>
              <div className="relative mt-1" ref={categoryDropdownRef}>
                <div
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center"
                >
                  {selectedCategories.length === 0 ? (
                    <span className="text-muted-foreground">Select categories...</span>
                  ) : (
                    selectedCategories.map((slug) => {
                      const cat = categories.find((c) => c.slug === slug);
                      return (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
                        >
                          {cat?.name || slug}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCategory(slug);
                            }}
                            className="hover:text-primary/70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                </div>

                {showCategoryDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => toggleCategory(cat.slug)}
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                      >
                        <span>
                          {cat.icon} {cat.name}
                        </span>
                        {selectedCategories.includes(cat.slug) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Job Count Preview */}
            {selectedCategories.length > 0 && (
              <div className={`p-3 rounded-lg border ${
                jobCountPreview && jobCountPreview.count < 5
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-green-50 border-green-200'
              }`}>
                {isLoadingJobCount ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Checking job availability...</span>
                  </div>
                ) : jobCountPreview ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      {jobCountPreview.count < 5 ? (
                        <>
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-amber-800">
                            Only {jobCountPreview.count} job{jobCountPreview.count !== 1 ? 's' : ''} in the last 7 days
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-green-800">
                            {jobCountPreview.count} jobs in the last 7 days (~{jobCountPreview.dailyAverage}/day)
                          </span>
                        </>
                      )}
                    </div>
                    {jobCountPreview.count < 5 && selectedCategories.length === 1 && (
                      <p className="text-xs text-amber-700">
                        Tip: Add more categories to receive more job alerts.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Country Preferences */}
            <div>
              <Label>Where do you want to work?</Label>
              <div className="relative mt-1" ref={countryDropdownRef}>
                <div
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center"
                >
                  {selectedCountries.length === 0 ? (
                    <span className="text-muted-foreground">Worldwide (all countries)</span>
                  ) : (
                    selectedCountries.map((code) => {
                      const c = countries.find((ct) => ct.code === code || ct.slug === code);
                      return (
                        <span
                          key={code}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
                        >
                          {c?.name || code}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeCountry(code);
                            }}
                            className="hover:text-primary/70"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })
                  )}
                  <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                </div>

                {showCountryDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {countries.filter(c => c.code).map((c) => (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCountry(c.code || c.slug)}
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between text-sm"
                      >
                        <span>{c.name}</span>
                        {selectedCountries.includes(c.code || c.slug) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Leave empty for worldwide/remote jobs</p>
            </div>

            {/* Translation Languages */}
            {showTranslationFields && (
              <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                <Label>Your Languages *</Label>
                <p className="text-xs text-muted-foreground -mt-1">Select languages you can translate (besides English)</p>
                <div className="relative" ref={languageDropdownRef}>
                  <div
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                    className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center bg-background"
                  >
                    {selectedLanguages.length === 0 ? (
                      <span className="text-muted-foreground">Select languages...</span>
                    ) : (
                      selectedLanguages.map((code) => {
                        const lang = languages.find((l) => l.code === code);
                        return (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
                          >
                            {lang?.name || code}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeLanguage(code);
                              }}
                              className="hover:text-primary/70"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })
                    )}
                    <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
                  </div>

                  {showLanguageDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {languages
                        .filter((l) => l.code !== 'EN')
                        .map((lang) => (
                          <button
                            key={lang.code}
                            type="button"
                            onClick={() => toggleLanguage(lang.code)}
                            className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                          >
                            <span>{lang.name}</span>
                            {selectedLanguages.includes(lang.code) && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Instant alerts notice */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>You&apos;ll get instant alerts for matching jobs</span>
            </div>

            {/* Resume Upload */}
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Resume (PDF) — <span className="text-muted-foreground font-normal">we&apos;ll auto-apply to matching projects for you</span>
              </label>
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer hover:file:bg-primary/20"
              />
              {resumeFile && (
                <p className="text-xs text-green-600 mt-1">{resumeFile.name} ready</p>
              )}
            </div>

            {/* Terms of Service Agreement */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms-email"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="terms-email" className="text-sm text-muted-foreground">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-primary underline hover:no-underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-primary underline hover:no-underline">
                  Privacy Policy
                </a>
                {resumeFile && '. Freelanly will apply to matching projects on my behalf.'}
              </label>
            </div>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={handleSendMagicLink}
          disabled={isLoading || isExistingUser === null || (isExistingUser === false && (selectedCategories.length === 0 || !agreedToTerms))}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send Magic Link
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll send a sign-in link to your email.
        </p>
      </div>
    );
  }

  // Step: Login (existing user)
  if (step === 'login') {
    const displayName = userInfo?.name?.split(' ')[0] || 'there';

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Welcome message */}
        <div className="text-center">
          <h2 className="text-xl font-semibold">Welcome back, {displayName}!</h2>
          <p className="mt-1 text-muted-foreground">{email}</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Magic Link */}
        <Button
          onClick={handleMagicLinkLogin}
          disabled={isLoading}
          className="w-full"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Send magic link
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll email you a link to sign in instantly.
        </p>
      </div>
    );
  }

  // Step: Register (new user)
  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={goBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold">Create your account</h2>
        <p className="mt-1 text-muted-foreground">{email}</p>
      </div>

      {/* Job context */}
      {showJobContext && jobTitle && companyName && (
        <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
          Apply to <strong>{jobTitle}</strong> at <strong>{companyName}</strong>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleRegistrationSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="name">Name (optional)</Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="mt-1"
          />
        </div>

        {/* Categories Multi-select */}
        <div>
          <Label>What roles interest you? *</Label>
          <div className="relative mt-1" ref={categoryDropdownRef}>
            {/* Selected categories chips */}
            <div
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center"
            >
              {selectedCategories.length === 0 ? (
                <span className="text-muted-foreground">Select categories...</span>
              ) : (
                selectedCategories.map((slug) => {
                  const cat = categories.find((c) => c.slug === slug);
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
                    >
                      {cat?.name || slug}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCategory(slug);
                        }}
                        className="hover:text-primary/70"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })
              )}
              <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            {/* Dropdown */}
            {showCategoryDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => toggleCategory(cat.slug)}
                    className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                  >
                    <span>
                      {cat.icon} {cat.name}
                    </span>
                    {selectedCategories.includes(cat.slug) && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Job Count Preview */}
        {selectedCategories.length > 0 && (
          <div className={`p-3 rounded-lg border ${
            jobCountPreview && jobCountPreview.count < 5
              ? 'bg-amber-50 border-amber-200'
              : 'bg-green-50 border-green-200'
          }`}>
            {isLoadingJobCount ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Checking job availability...</span>
              </div>
            ) : jobCountPreview ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {jobCountPreview.count < 5 ? (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <span className="font-medium text-amber-800">
                        Only {jobCountPreview.count} job{jobCountPreview.count !== 1 ? 's' : ''} in the last 7 days
                      </span>
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-800">
                        {jobCountPreview.count} jobs in the last 7 days (~{jobCountPreview.dailyAverage}/day)
                      </span>
                    </>
                  )}
                </div>
                {jobCountPreview.count < 5 && selectedCategories.length === 1 && (
                  <p className="text-xs text-amber-700">
                    Tip: Add more categories to receive more job alerts.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Translation Languages */}
        {showTranslationFields && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
            <Label>Your Languages *</Label>
            <p className="text-xs text-muted-foreground -mt-1">Select languages you can translate (besides English)</p>
            <div className="relative" ref={languageDropdownRef}>
              {/* Selected languages chips */}
              <div
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="min-h-[42px] px-3 py-2 border rounded-lg cursor-pointer flex flex-wrap gap-1.5 items-center bg-background"
              >
                {selectedLanguages.length === 0 ? (
                  <span className="text-muted-foreground">Select languages...</span>
                ) : (
                  selectedLanguages.map((code) => {
                    const lang = languages.find((l) => l.code === code);
                    return (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-sm"
                      >
                        {lang?.name || code}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLanguage(code);
                          }}
                          className="hover:text-primary/70"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })
                )}
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
              </div>

              {/* Dropdown */}
              {showLanguageDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {languages
                    .filter((l) => l.code !== 'EN') // Exclude English - it's implicit
                    .map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                      >
                        <span>{lang.name}</span>
                        {selectedLanguages.includes(lang.code) && (
                          <Check className="h-4 w-4 text-primary" />
                        )}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error message */}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Instant alerts notice */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span>You&apos;ll get instant alerts for matching jobs</span>
        </div>

        {/* Resume Upload (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1.5">
            Resume (PDF) — <span className="text-muted-foreground font-normal">optional, enables auto-apply</span>
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:bg-primary/10 file:text-primary file:font-medium file:cursor-pointer hover:file:bg-primary/20"
          />
          {resumeFile && (
            <p className="text-xs text-green-600 mt-1">{resumeFile.name} ready</p>
          )}
        </div>

        {/* Terms of Service Agreement */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="terms"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <label htmlFor="terms" className="text-sm text-muted-foreground">
            I agree to the{' '}
            <a href="/terms" target="_blank" className="text-primary underline hover:no-underline">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" className="text-primary underline hover:no-underline">
              Privacy Policy
            </a>
            . {resumeFile && 'Freelanly will apply to matching projects on my behalf.'}
          </label>
        </div>

        {/* Submit */}
        <Button type="submit" className="w-full" size="lg" disabled={isLoading || !agreedToTerms}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Get Started Free'
          )}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        You&apos;ll receive job alerts. Unsubscribe anytime.
      </p>
    </div>
  );
}
