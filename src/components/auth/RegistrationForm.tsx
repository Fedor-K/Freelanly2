'use client';

import { useState, useRef, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { categories, countries, languages } from '@/config/site';
import { Mail, ChevronDown, Check, X, Zap } from 'lucide-react';

interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

export interface RegistrationFormProps {
  /** Job context (optional) */
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  /** Redirect URL after successful auth */
  callbackUrl?: string;
  /** Called when email is sent successfully */
  onEmailSent?: (email: string) => void;
  /** Show job context message */
  showJobContext?: boolean;
}

const TRANSLATION_TYPES = [
  { value: 'WRITTEN', label: 'Written Translation' },
  { value: 'INTERPRETATION', label: 'Interpretation' },
  { value: 'LOCALIZATION', label: 'Localization' },
  { value: 'SUBTITLING', label: 'Subtitling' },
];

export function RegistrationForm({
  jobId,
  jobTitle,
  companyName,
  callbackUrl,
  onEmailSent,
  showJobContext = false,
}: RegistrationFormProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showTranslationFields = selectedCategories.includes('translation');

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const removeCategory = (slug: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== slug));
    if (slug === 'translation') {
      setLanguagePairs([]);
    }
  };

  const addLanguagePair = () => {
    setLanguagePairs((prev) => [
      ...prev,
      { translationType: 'WRITTEN', sourceLanguage: 'EN', targetLanguage: '' },
    ]);
  };

  const updateLanguagePair = (index: number, field: keyof LanguagePair, value: string) => {
    setLanguagePairs((prev) =>
      prev.map((pair, i) => (i === index ? { ...pair, [field]: value } : pair))
    );
  };

  const removeLanguagePair = (index: number) => {
    setLanguagePairs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    // Store registration data in sessionStorage for after OAuth
    sessionStorage.setItem(
      'pendingRegistration',
      JSON.stringify({
        name,
        categories: selectedCategories,
        country: selectedCountry,
        languagePairs: showTranslationFields ? languagePairs : [],
      })
    );
    await signIn('google', { callbackUrl: callbackUrl || '/dashboard' });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (selectedCategories.length === 0) {
      setError('Please select at least one job category');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // First, register user preferences
      const regResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          categories: selectedCategories,
          country: selectedCountry || undefined,
          languagePairs: showTranslationFields ? languagePairs : undefined,
          jobId,
        }),
      });

      if (!regResponse.ok) {
        const data = await regResponse.json();
        throw new Error(data.error || 'Registration failed');
      }

      // Then send magic link
      const result = await signIn('resend', {
        email,
        callbackUrl: callbackUrl || '/dashboard',
        redirect: false,
      });

      if (result?.ok) {
        setEmailSent(true);
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

  // Success state after email sent
  if (emailSent) {
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
        <p className="text-sm text-muted-foreground">
          Click the link to complete registration and start receiving job alerts!
        </p>
        <button
          onClick={() => {
            setEmailSent(false);
            setEmail('');
          }}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

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

      {/* Email Form */}
      <form onSubmit={handleEmailSignIn} className="space-y-4">
        {/* Email */}
        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="mt-1"
          />
        </div>

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
          <div className="relative mt-1" ref={dropdownRef}>
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

        {/* Translation Language Pairs */}
        {showTranslationFields && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <Label>Language Pairs</Label>
            {languagePairs.map((pair, index) => (
              <div key={index} className="flex gap-2 items-start">
                <select
                  value={pair.translationType}
                  onChange={(e) => updateLanguagePair(index, 'translationType', e.target.value)}
                  className="flex-1 px-2 py-1.5 border rounded text-sm bg-background"
                >
                  {TRANSLATION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  value={pair.sourceLanguage}
                  onChange={(e) => updateLanguagePair(index, 'sourceLanguage', e.target.value)}
                  className="w-24 px-2 py-1.5 border rounded text-sm bg-background"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <span className="py-1.5 text-muted-foreground">→</span>
                <select
                  value={pair.targetLanguage}
                  onChange={(e) => updateLanguagePair(index, 'targetLanguage', e.target.value)}
                  className="w-24 px-2 py-1.5 border rounded text-sm bg-background"
                >
                  <option value="">Select</option>
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeLanguagePair(index)}
                  className="p-1.5 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLanguagePair}
            >
              + Add language pair
            </Button>
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
        <Button type="submit" className="w-full" size="lg" disabled={isLoading || !email}>
          {isLoading ? 'Creating account...' : 'Get Started Free'}
        </Button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        By signing up, you agree to receive job alerts. Unsubscribe anytime.
      </p>
    </div>
  );
}
