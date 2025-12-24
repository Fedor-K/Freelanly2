import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { categories } from '@/config/site';

export default function NotFound() {
  // Popular categories for suggestions
  const popularCategories = categories.slice(0, 8);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1 container py-16">
        <div className="max-w-2xl mx-auto text-center">
          {/* 404 Header */}
          <div className="mb-8">
            <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
            <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
              Don't worry — we have thousands of remote jobs waiting for you!
            </p>
          </div>

          {/* Search Suggestion */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground mb-4">
                Looking for a specific job? Try browsing our categories:
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {popularCategories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/jobs/${category.slug}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-sm transition-colors"
                  >
                    <span>{category.icon}</span>
                    <span>{category.name}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" asChild>
              <Link href="/jobs">Browse All Jobs</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/">Go to Homepage</Link>
            </Button>
          </div>

          {/* Popular Searches */}
          <div className="text-left">
            <h3 className="font-semibold mb-4">Popular Searches</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <Link href="/jobs/engineering" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote Software Engineer Jobs
              </Link>
              <Link href="/jobs/design" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote Design Jobs
              </Link>
              <Link href="/jobs/product" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote Product Manager Jobs
              </Link>
              <Link href="/jobs/marketing" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote Marketing Jobs
              </Link>
              <Link href="/jobs/data" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote Data Science Jobs
              </Link>
              <Link href="/jobs/devops" className="text-muted-foreground hover:text-foreground hover:underline">
                → Remote DevOps Jobs
              </Link>
              <Link href="/companies" className="text-muted-foreground hover:text-foreground hover:underline">
                → Browse Companies Hiring
              </Link>
              <Link href="/country" className="text-muted-foreground hover:text-foreground hover:underline">
                → Jobs by Country
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
