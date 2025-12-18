'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { siteConfig, categories } from '@/config/site';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/jobs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              All Jobs
            </Link>
            {categories.slice(0, 5).map((category) => (
              <Link
                key={category.slug}
                href={`/jobs/${category.slug}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {category.name}
              </Link>
            ))}
            <Link
              href="/companies"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Companies
            </Link>
            <Link
              href="/country"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              By Country
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/pricing">
            <Button variant="ghost" size="sm">
              Pricing
            </Button>
          </Link>
          <Link href="/employers">
            <Button size="sm">
              Post a Job
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
