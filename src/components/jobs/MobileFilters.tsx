'use client';

import { useState } from 'react';
import Link from 'next/link';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { categories, levels, jobTypes, countries, techStacks, salaryRanges } from '@/config/site';

interface MobileFiltersProps {
  currentFilters: {
    search?: string;
    levels: string[];
    types: string[];
    country?: string;
    salary?: string;
    skills: string[];
  };
  activeFilterCount: number;
}

export function MobileFilters({ currentFilters, activeFilterCount }: MobileFiltersProps) {
  const [open, setOpen] = useState(false);

  // Build URL helper
  const buildFilterUrl = (changes: Record<string, string | string[] | undefined>): string => {
    const params = new URLSearchParams();
    const merged = { ...getCurrentParams(), ...changes };

    for (const [key, value] of Object.entries(merged)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => params.append(key, v));
      } else {
        params.set(key, value);
      }
    }

    const queryString = params.toString();
    return queryString ? `/jobs?${queryString}` : '/jobs';
  };

  const getCurrentParams = () => ({
    q: currentFilters.search,
    level: currentFilters.levels.length > 0 ? currentFilters.levels : undefined,
    type: currentFilters.types.length > 0 ? currentFilters.types : undefined,
    country: currentFilters.country,
    salary: currentFilters.salary,
    skills: currentFilters.skills.length > 0 ? currentFilters.skills : undefined,
  });

  const popularSkills = techStacks.slice(0, 12);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          {/* Categories */}
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {categories.slice(0, 10).map((category) => (
                <Link
                  key={category.slug}
                  href={`/jobs/${category.slug}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                >
                  {category.icon} {category.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Country */}
          <div>
            <label className="text-sm font-medium mb-2 block">🌍 Location</label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {countries.slice(0, 10).map((country) => {
                const isActive = currentFilters.country === country.slug;
                const href = buildFilterUrl({
                  country: isActive ? undefined : country.slug,
                });

                return (
                  <Link
                    key={country.slug}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-muted ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{country.flag}</span>
                    {country.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Salary */}
          <div>
            <label className="text-sm font-medium mb-2 block">💰 Min Salary</label>
            <div className="space-y-1">
              {salaryRanges.slice(0, 5).map((range) => {
                const isActive = currentFilters.salary === range.value;
                const href = buildFilterUrl({
                  salary: isActive ? undefined : range.value,
                });

                return (
                  <Link
                    key={range.value}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-muted ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                      isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'
                    }`}>
                      {isActive && '✓'}
                    </span>
                    {range.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Level */}
          <div>
            <label className="text-sm font-medium mb-2 block">📊 Experience</label>
            <div className="space-y-1">
              {levels.slice(0, 6).map((level) => {
                const isActive = currentFilters.levels.includes(level.value);
                const newLevels = isActive
                  ? currentFilters.levels.filter((l) => l !== level.value)
                  : [...currentFilters.levels, level.value];
                const href = buildFilterUrl({
                  level: newLevels.length > 0 ? newLevels : undefined,
                });

                return (
                  <Link
                    key={level.value}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-muted ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                      isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'
                    }`}>
                      {isActive && '✓'}
                    </span>
                    {level.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Job Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">📋 Job Type</label>
            <div className="space-y-1">
              {jobTypes.map((type) => {
                const isActive = currentFilters.types.includes(type.value);
                const newTypes = isActive
                  ? currentFilters.types.filter((t) => t !== type.value)
                  : [...currentFilters.types, type.value];
                const href = buildFilterUrl({
                  type: newTypes.length > 0 ? newTypes : undefined,
                });

                return (
                  <Link
                    key={type.value}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-muted ${
                      isActive ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    <span className={`w-4 h-4 border rounded flex items-center justify-center ${
                      isActive ? 'bg-primary border-primary text-white' : 'border-gray-300'
                    }`}>
                      {isActive && '✓'}
                    </span>
                    {type.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <label className="text-sm font-medium mb-2 block">🛠️ Tech Stack</label>
            <div className="flex flex-wrap gap-2">
              {popularSkills.map((tech) => {
                const isActive = currentFilters.skills.includes(tech.slug);
                const newSkills = isActive
                  ? currentFilters.skills.filter((s) => s !== tech.slug)
                  : [...currentFilters.skills, tech.slug];
                const href = buildFilterUrl({
                  skills: newSkills.length > 0 ? newSkills : undefined,
                });

                return (
                  <Link
                    key={tech.slug}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {tech.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <Link href="/jobs" onClick={() => setOpen(false)} className="w-full">
            <Button variant="outline" className="w-full">
              Clear all filters
            </Button>
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
