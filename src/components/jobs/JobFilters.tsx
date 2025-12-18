'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { techStacks, companySizes, salaryRanges, levels, jobTypes } from '@/config/site';

interface JobFiltersProps {
  basePath: string;
  currentFilters: {
    tech?: string;
    salary?: string;
    size?: string;
    level?: string;
    type?: string;
  };
}

export function JobFilters({ basePath, currentFilters }: JobFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    tech: currentFilters.tech || '',
    salary: currentFilters.salary || '',
    size: currentFilters.size || '',
    level: currentFilters.level || '',
    type: currentFilters.type || '',
  });

  const applyFilters = useCallback((newFilters: typeof filters) => {
    const params = new URLSearchParams();

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(`${basePath}${queryString ? `?${queryString}` : ''}`);
  }, [basePath, router]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    applyFilters(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters = { tech: '', salary: '', size: '', level: '', type: '' };
    setFilters(emptyFilters);
    router.push(basePath);
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  return (
    <div className="sticky top-20 space-y-6">
      {/* Clear Filters */}
      {hasActiveFilters && (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Active Filters</span>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      {/* Tech Stack Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Tech Stack</label>
        <select
          value={filters.tech}
          onChange={(e) => handleFilterChange('tech', e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Technologies</option>
          {techStacks.map((tech) => (
            <option key={tech.slug} value={tech.name}>
              {tech.name}
            </option>
          ))}
        </select>
      </div>

      {/* Salary Range Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Salary Range</label>
        <select
          value={filters.salary}
          onChange={(e) => handleFilterChange('salary', e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any Salary</option>
          {salaryRanges.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      {/* Company Size Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Company Size</label>
        <select
          value={filters.size}
          onChange={(e) => handleFilterChange('size', e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Any Size</option>
          {companySizes.map((size) => (
            <option key={size.value} value={size.value}>
              {size.label}
            </option>
          ))}
        </select>
      </div>

      {/* Seniority Level Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Seniority Level</label>
        <div className="space-y-1">
          {levels.map((level) => (
            <label
              key={level.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.level === level.value}
                onChange={(e) => handleFilterChange('level', e.target.checked ? level.value : '')}
                className="rounded border-input"
              />
              {level.label}
            </label>
          ))}
        </div>
      </div>

      {/* Contract Type Filter */}
      <div>
        <label className="text-sm font-medium mb-2 block">Contract Type</label>
        <div className="space-y-1">
          {jobTypes.map((type) => (
            <label
              key={type.value}
              className="flex items-center gap-2 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={filters.type === type.value}
                onChange={(e) => handleFilterChange('type', e.target.checked ? type.value : '')}
                className="rounded border-input"
              />
              {type.label}
            </label>
          ))}
        </div>
      </div>

      {/* Filter Summary */}
      <div className="pt-4 border-t text-xs text-muted-foreground">
        <p>Filter jobs by technology, salary, company size, experience level, and contract type.</p>
      </div>
    </div>
  );
}
