'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { languages } from '@/config/site';

interface LanguagePairFilterProps {
  currentSourceLang?: string;
  currentTargetLang?: string;
  /**
   * Base path for building filter URLs.
   * If not provided, uses current pathname.
   */
  basePath?: string;
}

/**
 * Universal language pair filter for translation jobs.
 * Adds sourceLang and targetLang URL parameters.
 * Only visible when filtering translation category.
 */
export function LanguagePairFilter({
  currentSourceLang,
  currentTargetLang,
  basePath,
}: LanguagePairFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSourceChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set('sourceLang', value);
    } else {
      params.delete('sourceLang');
    }
    params.delete('page'); // Reset pagination

    const queryString = params.toString();
    const path = basePath || pathname;
    router.push(queryString ? `${path}?${queryString}` : path);
  };

  const handleTargetChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set('targetLang', value);
    } else {
      params.delete('targetLang');
    }
    params.delete('page'); // Reset pagination

    const queryString = params.toString();
    const path = basePath || pathname;
    router.push(queryString ? `${path}?${queryString}` : path);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium block">Language Pair</label>

      {/* Source Language */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">From</label>
        <select
          value={currentSourceLang || ''}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
        >
          <option value="">Any language</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Target Language */}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">To</label>
        <select
          value={currentTargetLang || ''}
          onChange={(e) => handleTargetChange(e.target.value)}
          className="w-full px-3 py-2 text-sm border rounded-lg bg-background"
        >
          <option value="">Any language</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>

      {/* Clear button if any language is selected */}
      {(currentSourceLang || currentTargetLang) && (
        <button
          onClick={() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('sourceLang');
            params.delete('targetLang');
            params.delete('page');

            const queryString = params.toString();
            const path = basePath || pathname;
            router.push(queryString ? `${path}?${queryString}` : path);
          }}
          className="text-xs text-primary hover:underline"
        >
          Clear language filter
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for mobile filters
 */
export function LanguagePairFilterCompact({
  currentSourceLang,
  currentTargetLang,
  basePath,
}: LanguagePairFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const buildUrl = (sourceLang?: string, targetLang?: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (sourceLang) {
      params.set('sourceLang', sourceLang);
    } else {
      params.delete('sourceLang');
    }

    if (targetLang) {
      params.set('targetLang', targetLang);
    } else {
      params.delete('targetLang');
    }

    params.delete('page');

    const queryString = params.toString();
    const path = basePath || pathname;
    return queryString ? `${path}?${queryString}` : path;
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium block">Language Pair</label>
      <div className="flex gap-2 items-center">
        <select
          value={currentSourceLang || ''}
          onChange={(e) => router.push(buildUrl(e.target.value, currentTargetLang))}
          className="flex-1 px-2 py-1.5 text-sm border rounded bg-background"
        >
          <option value="">From...</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <span className="text-muted-foreground">→</span>
        <select
          value={currentTargetLang || ''}
          onChange={(e) => router.push(buildUrl(currentSourceLang, e.target.value))}
          className="flex-1 px-2 py-1.5 text-sm border rounded bg-background"
        >
          <option value="">To...</option>
          {languages.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
