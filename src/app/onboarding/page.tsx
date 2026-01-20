'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { categories, countries, languages } from '@/config/site';
import { ChevronDown, Check, X, Zap, Loader2 } from 'lucide-react';

interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

const TRANSLATION_TYPES = [
  { value: 'TRANSLATION', label: 'Translation' },
  { value: 'INTERPRETATION', label: 'Interpretation' },
  { value: 'LOCALIZATION', label: 'Localization' },
  { value: 'SUBTITLING', label: 'Subtitling' },
];

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard';

  // Form fields
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [languagePairs, setLanguagePairs] = useState<LanguagePair[]>([]);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [error, setError] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Redirect if not authenticated or doesn't need onboarding
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && !session?.user?.needsOnboarding) {
      router.push(callbackUrl);
    }
  }, [status, session, router, callbackUrl]);

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

  // Category handlers
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

  // Language pair handlers
  const addLanguagePair = () => {
    setLanguagePairs((prev) => [
      ...prev,
      { translationType: 'TRANSLATION', sourceLanguage: 'EN', targetLanguage: '' },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedCategories.length === 0) {
      setError('Please select at least one job category');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: selectedCategories,
          country: selectedCountry || undefined,
          languagePairs: showTranslationFields ? languagePairs : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to complete setup');
      }

      // Refresh session to clear needsOnboarding
      await update();

      // Clear stored callback URL
      sessionStorage.removeItem('onboarding-callback-url');

      // Redirect to jobs page for first selected category (better engagement)
      // If user came from a specific page, use that instead
      if (callbackUrl !== '/dashboard' && !callbackUrl.startsWith('/onboarding')) {
        router.push(callbackUrl);
      } else {
        // Redirect to first selected category's jobs page
        const firstCategory = selectedCategories[0];
        router.push(`/jobs/${firstCategory}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-black">
            Freelanly
          </a>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-semibold">Welcome to Freelanly!</h1>
            <p className="mt-2 text-muted-foreground">
              Tell us what roles interest you so we can send you relevant job alerts.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
                  <div key={index} className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-start">
                    {/* Type select - full width on mobile */}
                    <select
                      value={pair.translationType}
                      onChange={(e) => updateLanguagePair(index, 'translationType', e.target.value)}
                      className="w-full sm:flex-1 px-2 py-1.5 border rounded text-sm bg-background"
                    >
                      {TRANSLATION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                    {/* Language pair row */}
                    <div className="flex gap-2 items-center">
                      <select
                        value={pair.sourceLanguage}
                        onChange={(e) => updateLanguagePair(index, 'sourceLanguage', e.target.value)}
                        className="flex-1 sm:w-24 sm:flex-none px-2 py-1.5 border rounded text-sm bg-background"
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
                        className="flex-1 sm:w-24 sm:flex-none px-2 py-1.5 border rounded text-sm bg-background"
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
                        className="p-1.5 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addLanguagePair}>
                  + Add language pair
                </Button>
              </div>
            )}

            {/* Error message */}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Instant alerts notice */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-2 rounded">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span>You'll get instant alerts for matching jobs</span>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
