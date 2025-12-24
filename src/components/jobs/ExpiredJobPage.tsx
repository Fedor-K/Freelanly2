'use client';

import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyLogo } from '@/components/ui/CompanyLogo';
import { AlertCircle, Search, Bell, ArrowRight } from 'lucide-react';

interface SimilarJob {
  id: string;
  slug: string;
  title: string;
  location: string | null;
  company: {
    name: string;
    slug: string;
    logo: string | null;
    website: string | null;
  };
}

interface ExpiredJobPageProps {
  jobSlug: string;
  similarJobs: SimilarJob[];
}

export function ExpiredJobPage({ jobSlug, similarJobs }: ExpiredJobPageProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-12">
          <div className="max-w-2xl mx-auto text-center">
            {/* Icon */}
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-orange-600" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold mb-4">
              This job is no longer available
            </h1>

            {/* Description */}
            <p className="text-lg text-muted-foreground mb-8">
              The position you&apos;re looking for has been filled or is no longer accepting applications.
              Don&apos;t worry — we have thousands of other remote opportunities waiting for you!
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Button asChild size="lg">
                <Link href="/jobs">
                  <Search className="w-4 h-4 mr-2" />
                  Browse All Jobs
                </Link>
              </Button>
              <Button variant="outline" asChild size="lg">
                <Link href="/dashboard/alerts">
                  <Bell className="w-4 h-4 mr-2" />
                  Set Up Job Alerts
                </Link>
              </Button>
            </div>
          </div>

          {/* Similar Jobs */}
          {similarJobs.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-center mb-6">
                Check out these similar opportunities
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
                {similarJobs.map((job) => (
                  <Link
                    key={job.id}
                    href={`/company/${job.company.slug}/jobs/${job.slug}`}
                    className="block"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex gap-3">
                          <CompanyLogo
                            name={job.company.name}
                            logo={job.company.logo}
                            website={job.company.website}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-2">
                              {job.title}
                            </h3>
                            <p className="text-sm text-muted-foreground truncate">
                              {job.company.name}
                            </p>
                            {job.location && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {job.location}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link href="/jobs" className="inline-flex items-center text-primary hover:underline">
                  View all available jobs
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </div>
            </div>
          )}

          {/* SEO-friendly info */}
          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>
              Looking for remote jobs? Freelanly aggregates opportunities from LinkedIn, top job boards,
              and company career pages. New positions are added daily.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
