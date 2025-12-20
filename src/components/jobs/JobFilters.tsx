'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';

interface JobFiltersProps {
  currentSearch?: string;
}

export function JobFilters({ currentSearch }: JobFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(currentSearch || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(window.location.search);

    if (search.trim()) {
      params.set('q', search.trim());
    } else {
      params.delete('q');
    }
    params.delete('page'); // Reset to page 1 on new search

    const queryString = params.toString();
    router.push(queryString ? `/jobs?${queryString}` : '/jobs');
  };

  return (
    <div>
      <label className="text-sm font-medium mb-2 block">Search</label>
      <form onSubmit={handleSearch}>
        <Input
          placeholder="Job title, company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </form>
    </div>
  );
}
