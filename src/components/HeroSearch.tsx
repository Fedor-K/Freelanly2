'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function HeroSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/freelance?q=${encodeURIComponent(q)}`);
    } else {
      router.push('/freelance');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto mb-8">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder='Search "freelance designer", "Translator"...'
        className="w-full pl-12 pr-24 py-3.5 text-base border-2 rounded-full bg-background focus:outline-none focus:border-primary transition-colors"
      />
      <button
        type="submit"
        className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-full hover:bg-primary/90 transition-colors"
      >
        Search
      </button>
    </form>
  );
}
