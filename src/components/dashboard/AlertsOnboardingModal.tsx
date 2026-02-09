'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { categories, countries, languages } from '@/config/site';
import { ChevronDown, Check, X, Loader2, Zap } from 'lucide-react';

const DISMISSED_KEY = 'alerts-onboarding-dismissed';

interface AlertsOnboardingModalProps {
  alertsCount: number;
}

export function AlertsOnboardingModal({ alertsCount }: AlertsOnboardingModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const languageDropdownRef = useRef<HTMLDivElement>(null);

  // Check if should show on mount
  useEffect(() => {
    if (alertsCount > 0) return;
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return;
    setOpen(true);
  }, [alertsCount]);

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

  const showTranslationFields = selectedCategories.includes('translation');

  const toggleCategory = (slug: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(slug)) {
        if (slug === 'translation') setSelectedLanguages([]);
        return prev.filter((c) => c !== slug);
      }
      return [...prev, slug];
    });
  };

  const removeCategory = (slug: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== slug));
    if (slug === 'translation') setSelectedLanguages([]);
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const removeLanguage = (code: string) => {
    setSelectedLanguages((prev) => prev.filter((l) => l !== code));
  };

  const handleSkip = () => {
    localStorage.setItem(DISMISSED_KEY, 'true');
    setOpen(false);
  };

  const handleCreate = async () => {
    if (selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }

    if (showTranslationFields && selectedLanguages.length === 0) {
      setError('Please select at least one language for translation alerts');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await Promise.all(
        selectedCategories.map((category) =>
          fetch('/api/user/alerts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category,
              country: selectedCountry || undefined,
              languages: category === 'translation' ? selectedLanguages : undefined,
            }),
          }).then((res) => {
            if (!res.ok) throw new Error('Failed to create alert');
          })
        )
      );

      setOpen(false);
      router.refresh();
    } catch {
      setError('Failed to create alerts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (alertsCount > 0) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip(); }}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Set Up Job Alerts
          </DialogTitle>
          <DialogDescription className="text-center">
            Get instant notifications when new jobs match your interests.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Country */}
          <div>
            <Label htmlFor="onboarding-country">Preferred country (optional)</Label>
            <select
              id="onboarding-country"
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            onClick={handleCreate}
            disabled={isLoading || selectedCategories.length === 0}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating alerts...
              </>
            ) : (
              'Create Alerts'
            )}
          </Button>

          <button
            onClick={handleSkip}
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
