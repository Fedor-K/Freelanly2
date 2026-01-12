'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categories, countries, languages } from '@/config/site';
import { Mail, ChevronDown, Check, X, Zap, ArrowLeft, Loader2, AlertTriangle, TrendingUp } from 'lucide-react';

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
  // Form step
  const [step, setStep] = useState<FormStep>('email');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [error, setError] = useState('');

  // Job count preview
  const [jobCountPreview, setJobCountPreview] = useState<JobCountPreview | null>(null);
  const [isLoadingJobCount, setIsLoadingJobCount] = useState(false);

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch job count preview when filters change
  const fetchJobCount = useCallback(async () => {
    if (selectedCategories.length === 0) {
      setJobCountPreview(null);
      return;
    }

    setIsLoadingJobCount(true);
    try {
      // Fetch count for each category and sum up
      const counts = await Promise.all(
        selectedCategories.map(async (category) => {
          const params = new URLSearchParams({ category, days: '7' });
          if (selectedCountry) params.set('country', selectedCountry);
          const res = await fetch(`/api/jobs/count?${params}`);
          return res.json();
        })
      );

      const totalCount = counts.reduce((sum, c) => sum + (c.count || 0), 0);
      const totalWithoutCountry = counts.reduce((sum, c) => sum + (c.countWithoutCountry || 0), 0);
      const avgDaily = counts.reduce((sum, c) => sum + (c.dailyAverage || 0), 0);

      setJobCountPreview({
        count: totalCount,
        countWithoutCountry: totalWithoutCountry,
        dailyAverage: Math.round(avgDaily * 10) / 10,
      });
    } catch (err) {
      console.error('Failed to fetch job count:', err);
      setJobCountPreview(null);
    } finally {
      setIsLoadingJobCount(false);
    }
  }, [selectedCategories, selectedCountry]);

  // Debounced fetch on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (step === 'register') {
        fetchJobCount();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedCategories, selectedCountry, step, fetchJobCount]);

  const showTranslationFields = selectedCategories.includes('translation');

  // Check if email exists
  const checkEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setIsCheckingEmail(true);
    setError('');

    try {
      const response = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.exists) {
        setUserInfo({ name: data.name, isVerified: data.isVerified });
        setStep('login');
      } else {
        setStep('register');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      checkEmail();
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
          country: selectedCountry,
          languages: showTranslationFields ? selectedLanguages : [],
        })
      );
    }

    await signIn('google', { callbackUrl: callbackUrl || '/dashboard' });
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
          country: selectedCountry || undefined,
          languages: showTranslationFields ? selectedLanguages : undefined,
          jobId,
        }),
      });

      if (!regResponse.ok) {
        const data = await regResponse.json();
        throw new Error(data.error || 'Registration failed');
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
      } else {
        throw new Error('Failed to send magic link');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  // Step: Email Sent
  if (step === 'sent') {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Check your email</h2>
        <p className="text-muted-foreground mb-4">
          We sent a sign in link to
          <br />
          <span className="font-medium text-foreground">{email}</span>
        </p>
        <button
          onClick={() => {
            setStep('email');
            setEmail('');
            setUserInfo(null);
          }}
          className="text-sm text-muted-foreground hover:text-foreground underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  // Step: Email Input
  if (step === 'email') {
    return (
      <div className="space-y-6">
        {/* Job context */}
        {showJobContext && jobTitle && companyName && (
          <div className="rounded-lg bg-muted/50 p-3 text-center text-sm">
            Apply to <strong>{jobTitle}</strong> at <strong>{companyName}</strong>
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-medium">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-background text-muted-foreground">or with email</span>
          </div>
        </div>

        {/* Email Input */}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleEmailKeyDown}
            placeholder="your@email.com"
            className="mt-1"
            autoFocus
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button
          onClick={checkEmail}
          disabled={isCheckingEmail || !email}
          className="w-full"
          size="lg"
        >
          {isCheckingEmail ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            'Continue'
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          We&apos;ll check if you have an account or help you create one.
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

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="font-medium">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-background text-muted-foreground">or</span>
          </div>
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

      {/* Google Sign In */}
      <button
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="font-medium">Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-background text-muted-foreground">or complete profile</span>
        </div>
      </div>

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

        {/* Country */}
        <div>
          <Label htmlFor="country">Preferred country (optional)</Label>
          <select
            id="country"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg bg-background"
          >
            <option value="">Any country</option>
            {countries.map((c) => (
              <option key={c.code || c.slug} value={c.code || ''}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>
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
                {/* Suggestion to expand if count is low */}
                {jobCountPreview.count < 5 && selectedCountry && jobCountPreview.countWithoutCountry > jobCountPreview.count && (
                  <p className="text-xs text-amber-700">
                    Tip: {jobCountPreview.countWithoutCountry} jobs available worldwide.{' '}
                    <button
                      type="button"
                      onClick={() => setSelectedCountry('')}
                      className="underline hover:no-underline font-medium"
                    >
                      Remove country filter
                    </button>{' '}
                    to get more alerts.
                  </p>
                )}
                {jobCountPreview.count < 5 && !selectedCountry && selectedCategories.length === 1 && (
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

        {/* Submit */}
        <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
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
        By signing up, you agree to receive job alerts. Unsubscribe anytime.
      </p>
    </div>
  );
}
