'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { siteConfig, mainCategories } from '@/config/site';
import { UserMenu } from '@/components/auth/UserMenu';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4 md:gap-6">
          {/* Mobile Menu Button */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] sm:w-[320px]">
              <SheetHeader>
                <SheetTitle>{siteConfig.name}</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                <Link
                  href="/jobs"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg font-medium hover:text-primary transition-colors"
                >
                  All Jobs
                </Link>
                <div className="border-t pt-4">
                  <span className="text-sm text-muted-foreground mb-2 block">Categories</span>
                  {mainCategories.map((category) => (
                    <Link
                      key={category.slug}
                      href={`/jobs/${category.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {category.icon} {category.name}
                    </Link>
                  ))}
                </div>
                <div className="border-t pt-4">
                  <Link
                    href="/companies"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Companies
                  </Link>
                  <Link
                    href="/country"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    By Country
                  </Link>
                  <Link
                    href="/pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Pricing
                  </Link>
                </div>
                <div className="border-t pt-4">
                  <Link
                    href="/employers"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block"
                  >
                    <Button className="w-full">Post a Job</Button>
                  </Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">{siteConfig.name}</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/jobs"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              All Jobs
            </Link>
            {mainCategories.map((category) => (
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

        {/* Right side - Desktop */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/pricing" className="hidden sm:block">
            <Button variant="ghost" size="sm">
              Pricing
            </Button>
          </Link>
          <Link href="/employers" className="hidden sm:block">
            <Button size="sm">
              Post a Job
            </Button>
          </Link>
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
