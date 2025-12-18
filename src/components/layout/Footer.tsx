import Link from 'next/link';
import { siteConfig, categories, levels } from '@/config/site';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-xl font-bold">
              {siteConfig.name}
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Find remote jobs from LinkedIn posts and top companies. Apply directly via email.
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="font-semibold mb-3">Job Categories</h3>
            <ul className="space-y-2 text-sm">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link
                    href={`/jobs/${category.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {category.icon} {category.name} Jobs
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* By Level */}
          <div>
            <h3 className="font-semibold mb-3">Jobs by Level</h3>
            <ul className="space-y-2 text-sm">
              {levels.slice(0, 6).map((level) => (
                <li key={level.value}>
                  <Link
                    href={`/jobs?level=${level.value}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {level.label} Jobs
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Job Seekers */}
          <div>
            <h3 className="font-semibold mb-3">For Job Seekers</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/jobs"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Browse All Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Companies Hiring
                </Link>
              </li>
              <li>
                <Link
                  href="/remote-react-jobs"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remote React Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/remote-python-jobs"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remote Python Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* For Employers */}
          <div>
            <h3 className="font-semibold mb-3">For Employers</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/employers"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Post a Job
                </Link>
              </li>
              <li>
                <Link
                  href="/employers#pricing"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Employer Pricing
                </Link>
              </li>
              <li>
                <a
                  href="mailto:employers@freelanly.com"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Sales
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
