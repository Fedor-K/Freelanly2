'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { categories, countries } from '@/config/site';

const TOP_CATEGORIES = ['translation', 'engineering', 'design', 'data', 'writing', 'marketing', 'product', 'creative', 'support'];
const TOP_COUNTRIES_COUNT = 12;

export function FreelanceFilters({
  categoryFilter,
  countryFilter,
  searchQuery,
}: {
  categoryFilter: string | null;
  countryFilter: string | null;
  searchQuery?: string | null;
}) {
  const router = useRouter();
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [search, setSearch] = useState(searchQuery || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (categoryFilter) params.set('category', categoryFilter);
    if (countryFilter) params.set('country', countryFilter);
    if (search.trim()) params.set('q', search.trim());
    const qs = params.toString();
    router.push(qs ? `/freelance?${qs}` : '/freelance');
  };

  const visibleCategories = showAllCategories
    ? categories
    : categories.filter(c => TOP_CATEGORIES.includes(c.slug));

  const allCountries = countries.filter(c => c.code);
  const visibleCountries = showAllCountries
    ? allCountries
    : allCountries.slice(0, TOP_COUNTRIES_COUNT);

  return (
    <div className="space-y-3 mb-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search projects..."
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </form>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/freelance${countryFilter ? `?country=${countryFilter}` : ''}`}
          className={`text-xs px-3 py-1.5 rounded-full border ${!categoryFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
        >
          All
        </Link>
        {visibleCategories.map((cat) => (
          <Link
            key={cat.slug}
            href={`/freelance?category=${cat.slug}${countryFilter ? `&country=${countryFilter}` : ''}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${categoryFilter === cat.slug ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
          >
            {cat.icon} {cat.name}
          </Link>
        ))}
        {!showAllCategories && categories.length > TOP_CATEGORIES.length && (
          <button
            onClick={() => setShowAllCategories(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted"
          >
            +{categories.length - TOP_CATEGORIES.length} more
          </button>
        )}
      </div>

      {/* Country filter */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/freelance${categoryFilter ? `?category=${categoryFilter}` : ''}`}
          className={`text-xs px-3 py-1.5 rounded-full border ${!countryFilter ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
        >
          🌍 All Countries
        </Link>
        {visibleCountries.map((c) => (
          <Link
            key={c.slug}
            href={`/freelance?${categoryFilter ? `category=${categoryFilter}&` : ''}country=${c.code}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${countryFilter?.toUpperCase() === c.code ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border hover:bg-muted'}`}
          >
            {c.name}
          </Link>
        ))}
        {!showAllCountries && allCountries.length > TOP_COUNTRIES_COUNT && (
          <button
            onClick={() => setShowAllCountries(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted"
          >
            +{allCountries.length - TOP_COUNTRIES_COUNT} more
          </button>
        )}
      </div>
    </div>
  );
}
