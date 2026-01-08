'use client';

import { useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { categories, levels, jobTypes, countries, techStacks, salaryRanges, languages, translationTypes } from '@/config/site';
import { ChevronDown, X, Search, SlidersHorizontal } from 'lucide-react';

interface TopFiltersProps {
  currentFilters: {
    search?: string;
    levels: string[];
    types: string[];
    country?: string;
    salary?: string;
    skills: string[];
    category?: string;
    sourceLang?: string;
    targetLang?: string;
    workType?: string;
  };
  totalCount: number;
}

export function TopFilters({ currentFilters, totalCount }: TopFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [showAllFilters, setShowAllFilters] = useState(false);
  const [searchValue, setSearchValue] = useState(currentFilters.search || '');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const buildUrl = (changes: Record<string, string | string[] | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Remove page when filters change
    params.delete('page');

    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.delete(key);
        value.forEach(v => params.append(key, v));
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ q: searchValue || undefined }));
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const activeFilterCount =
    (currentFilters.search ? 1 : 0) +
    currentFilters.levels.length +
    currentFilters.types.length +
    (currentFilters.country ? 1 : 0) +
    (currentFilters.salary ? 1 : 0) +
    currentFilters.skills.length +
    (currentFilters.category ? 1 : 0) +
    (currentFilters.sourceLang ? 1 : 0) +
    (currentFilters.targetLang ? 1 : 0) +
    (currentFilters.workType ? 1 : 0);

  // Popular tech stacks to show
  const popularTech = techStacks.slice(0, 8);

  // Language jobs don't need Experience, Salary, Tech Stack filters
  const isLanguageCategory = currentFilters.category === 'translation';

  return (
    <div className="space-y-4">
      {/* Main Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </form>

        {/* Category Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleDropdown('category')}
            className={`gap-1 ${currentFilters.category ? 'border-primary text-primary' : ''}`}
          >
            {currentFilters.category
              ? categories.find(c => c.slug === currentFilters.category)?.name
              : 'Category'}
            <ChevronDown className="h-3 w-3" />
          </Button>
          {openDropdown === 'category' && (
            <div className="absolute z-50 mt-1 w-56 bg-background border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
              <Link
                href={buildUrl({ category: undefined, sourceLang: undefined, targetLang: undefined })}
                onClick={() => setOpenDropdown(null)}
                className={`block px-3 py-2 text-sm rounded hover:bg-muted ${!currentFilters.category ? 'bg-primary/10 text-primary' : ''}`}
              >
                All Categories
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={buildUrl({ category: cat.slug })}
                  onClick={() => setOpenDropdown(null)}
                  className={`block px-3 py-2 text-sm rounded hover:bg-muted ${currentFilters.category === cat.slug ? 'bg-primary/10 text-primary' : ''}`}
                >
                  {cat.icon} {cat.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Language Pair - only for translation */}
        {currentFilters.category === 'translation' && (
          <>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleDropdown('sourceLang')}
                className={`gap-1 ${currentFilters.sourceLang ? 'border-primary text-primary' : ''}`}
              >
                {currentFilters.sourceLang
                  ? `From: ${languages.find(l => l.code === currentFilters.sourceLang)?.name}`
                  : 'From'}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {openDropdown === 'sourceLang' && (
                <div className="absolute z-50 mt-1 w-48 bg-background border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { router.push(buildUrl({ sourceLang: undefined })); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${!currentFilters.sourceLang ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    Any language
                  </button>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { router.push(buildUrl({ sourceLang: lang.code })); setOpenDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${currentFilters.sourceLang === lang.code ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <span className="text-muted-foreground">→</span>
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleDropdown('targetLang')}
                className={`gap-1 ${currentFilters.targetLang ? 'border-primary text-primary' : ''}`}
              >
                {currentFilters.targetLang
                  ? `To: ${languages.find(l => l.code === currentFilters.targetLang)?.name}`
                  : 'To'}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {openDropdown === 'targetLang' && (
                <div className="absolute z-50 mt-1 w-48 bg-background border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { router.push(buildUrl({ targetLang: undefined })); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${!currentFilters.targetLang ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    Any language
                  </button>
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { router.push(buildUrl({ targetLang: lang.code })); setOpenDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${currentFilters.targetLang === lang.code ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Work Type Dropdown for Language Jobs */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleDropdown('workType')}
                className={`gap-1 ${currentFilters.workType ? 'border-primary text-primary' : ''}`}
              >
                {currentFilters.workType
                  ? translationTypes.find(t => t.value === currentFilters.workType)?.label
                  : 'Work Type'}
                <ChevronDown className="h-3 w-3" />
              </Button>
              {openDropdown === 'workType' && (
                <div className="absolute z-50 mt-1 w-56 bg-background border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
                  <button
                    onClick={() => { router.push(buildUrl({ workType: undefined })); setOpenDropdown(null); }}
                    className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${!currentFilters.workType ? 'bg-primary/10 text-primary' : ''}`}
                  >
                    All Types
                  </button>
                  {translationTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => { router.push(buildUrl({ workType: type.value })); setOpenDropdown(null); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted ${currentFilters.workType === type.value ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      {type.icon} {type.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Country Dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleDropdown('country')}
            className={`gap-1 ${currentFilters.country ? 'border-primary text-primary' : ''}`}
          >
            {currentFilters.country
              ? `${countries.find(c => c.slug === currentFilters.country)?.flag} ${countries.find(c => c.slug === currentFilters.country)?.name}`
              : '🌍 Location'}
            <ChevronDown className="h-3 w-3" />
          </Button>
          {openDropdown === 'country' && (
            <div className="absolute z-50 mt-1 w-48 bg-background border rounded-lg shadow-lg p-2 max-h-64 overflow-y-auto">
              <Link
                href={buildUrl({ country: undefined })}
                onClick={() => setOpenDropdown(null)}
                className={`block px-3 py-2 text-sm rounded hover:bg-muted ${!currentFilters.country ? 'bg-primary/10 text-primary' : ''}`}
              >
                🌍 Worldwide
              </Link>
              {countries.slice(0, 15).map((country) => (
                <Link
                  key={country.slug}
                  href={buildUrl({ country: country.slug })}
                  onClick={() => setOpenDropdown(null)}
                  className={`block px-3 py-2 text-sm rounded hover:bg-muted ${currentFilters.country === country.slug ? 'bg-primary/10 text-primary' : ''}`}
                >
                  {country.flag} {country.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Level Dropdown - hidden for language jobs */}
        {!isLanguageCategory && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleDropdown('level')}
              className={`gap-1 ${currentFilters.levels.length > 0 ? 'border-primary text-primary' : ''}`}
            >
              {currentFilters.levels.length > 0
                ? `${levels.find(l => l.value === currentFilters.levels[0])?.label}${currentFilters.levels.length > 1 ? ` +${currentFilters.levels.length - 1}` : ''}`
                : 'Experience'}
              <ChevronDown className="h-3 w-3" />
            </Button>
            {openDropdown === 'level' && (
              <div className="absolute z-50 mt-1 w-48 bg-background border rounded-lg shadow-lg p-2">
                {levels.slice(0, 6).map((level) => {
                  const isActive = currentFilters.levels.includes(level.value);
                  const newLevels = isActive
                    ? currentFilters.levels.filter(l => l !== level.value)
                    : [...currentFilters.levels, level.value];
                  return (
                    <Link
                      key={level.value}
                      href={buildUrl({ level: newLevels.length > 0 ? newLevels : undefined })}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-muted ${isActive ? 'bg-primary/10 text-primary' : ''}`}
                    >
                      <span className={`w-4 h-4 border rounded flex items-center justify-center text-xs ${isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                        {isActive && '✓'}
                      </span>
                      {level.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* More Filters Toggle - hidden for language jobs */}
        {!isLanguageCategory && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllFilters(!showAllFilters)}
            className="gap-1"
          >
            <SlidersHorizontal className="h-3 w-3" />
            More
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <Link href="/jobs">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              Clear all
            </Button>
          </Link>
        )}

        {/* Jobs Count */}
        <span className="text-sm text-muted-foreground ml-auto">
          {totalCount} jobs
        </span>
      </div>

      {/* Expanded Filters - hidden for language jobs */}
      {showAllFilters && !isLanguageCategory && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Job Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Job Type</label>
              <div className="flex flex-wrap gap-1">
                {jobTypes.map((type) => {
                  const isActive = currentFilters.types.includes(type.value);
                  const newTypes = isActive
                    ? currentFilters.types.filter(t => t !== type.value)
                    : [...currentFilters.types, type.value];
                  return (
                    <Link
                      key={type.value}
                      href={buildUrl({ type: newTypes.length > 0 ? newTypes : undefined })}
                      className={`text-xs px-2 py-1 rounded border ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    >
                      {type.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Salary */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Min Salary</label>
              <div className="flex flex-wrap gap-1">
                {salaryRanges.slice(0, 4).map((range) => {
                  const isActive = currentFilters.salary === range.value;
                  return (
                    <Link
                      key={range.value}
                      href={buildUrl({ salary: isActive ? undefined : range.value })}
                      className={`text-xs px-2 py-1 rounded border ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    >
                      {range.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Tech Stack */}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Tech Stack</label>
              <div className="flex flex-wrap gap-1">
                {popularTech.map((tech) => {
                  const isActive = currentFilters.skills.includes(tech.slug);
                  const newSkills = isActive
                    ? currentFilters.skills.filter(s => s !== tech.slug)
                    : [...currentFilters.skills, tech.slug];
                  return (
                    <Link
                      key={tech.slug}
                      href={buildUrl({ skills: newSkills.length > 0 ? newSkills : undefined })}
                      className={`text-xs px-2 py-1 rounded-full border ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
                    >
                      {tech.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {currentFilters.search && (
            <Link href={buildUrl({ q: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                Search: {currentFilters.search}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {currentFilters.category && (
            <Link href={buildUrl({ category: undefined, sourceLang: undefined, targetLang: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {categories.find(c => c.slug === currentFilters.category)?.icon} {categories.find(c => c.slug === currentFilters.category)?.name}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {currentFilters.sourceLang && (
            <Link href={buildUrl({ sourceLang: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                From: {languages.find(l => l.code === currentFilters.sourceLang)?.name}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {currentFilters.targetLang && (
            <Link href={buildUrl({ targetLang: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                To: {languages.find(l => l.code === currentFilters.targetLang)?.name}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {currentFilters.workType && (
            <Link href={buildUrl({ workType: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {translationTypes.find(t => t.value === currentFilters.workType)?.icon} {translationTypes.find(t => t.value === currentFilters.workType)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {currentFilters.country && (
            <Link href={buildUrl({ country: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {countries.find(c => c.slug === currentFilters.country)?.flag} {countries.find(c => c.slug === currentFilters.country)?.name}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {/* Hide salary/levels/types/skills badges for language jobs */}
          {!isLanguageCategory && currentFilters.salary && (
            <Link href={buildUrl({ salary: undefined })}>
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {salaryRanges.find(r => r.value === currentFilters.salary)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          )}

          {!isLanguageCategory && currentFilters.levels.map((level) => (
            <Link
              key={level}
              href={buildUrl({ level: currentFilters.levels.filter(l => l !== level).length > 0 ? currentFilters.levels.filter(l => l !== level) : undefined })}
            >
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {levels.find(l => l.value === level)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          ))}

          {!isLanguageCategory && currentFilters.types.map((type) => (
            <Link
              key={type}
              href={buildUrl({ type: currentFilters.types.filter(t => t !== type).length > 0 ? currentFilters.types.filter(t => t !== type) : undefined })}
            >
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {jobTypes.find(t => t.value === type)?.label}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          ))}

          {!isLanguageCategory && currentFilters.skills.map((skill) => (
            <Link
              key={skill}
              href={buildUrl({ skills: currentFilters.skills.filter(s => s !== skill).length > 0 ? currentFilters.skills.filter(s => s !== skill) : undefined })}
            >
              <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20">
                {techStacks.find(t => t.slug === skill)?.name}
                <X className="h-3 w-3" />
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Click outside to close dropdowns */}
      {openDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </div>
  );
}
