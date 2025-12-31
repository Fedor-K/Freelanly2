import Link from 'next/link';
import { siteConfig, categories, levels, countries, languagePairs } from '@/config/site';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-1">
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

          {/* Jobs by Country */}
          <div>
            <h3 className="font-semibold mb-3">Jobs by Country</h3>
            <ul className="space-y-2 text-sm">
              {countries.slice(0, 8).map((country) => (
                <li key={country.slug}>
                  <Link
                    href={`/jobs/country/${country.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {country.flag} {country.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/country"
                  className="text-primary hover:underline transition-colors"
                >
                  View all countries →
                </Link>
              </li>
            </ul>
          </div>

          {/* Translation Jobs */}
          <div>
            <h3 className="font-semibold mb-3">Translation Jobs</h3>
            <ul className="space-y-2 text-sm">
              {languagePairs.slice(0, 8).map((pair) => (
                <li key={pair.slug}>
                  <Link
                    href={`/jobs/translation/${pair.slug}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {pair.source.charAt(0).toUpperCase() + pair.source.slice(1)} → {pair.target.charAt(0).toUpperCase() + pair.target.slice(1)}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/jobs/translation"
                  className="text-primary hover:underline transition-colors"
                >
                  All translation jobs →
                </Link>
              </li>
            </ul>
          </div>

          {/* Popular Skills */}
          <div>
            <h3 className="font-semibold mb-3">Popular Skills</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/jobs/skills/react"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  React Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/skills/python"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Python Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/skills/typescript"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  TypeScript Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/skills/nodejs"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Node.js Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/skills/aws"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  AWS Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/skills/kubernetes"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Kubernetes Jobs
                </Link>
              </li>
            </ul>
          </div>

          {/* Jobs by Salary */}
          <div>
            <h3 className="font-semibold mb-3">Jobs by Salary</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/jobs/engineering/salary/50k-100k"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  $50K - $100K Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/engineering/salary/100k-150k"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  $100K - $150K Jobs
                </Link>
              </li>
              <li>
                <Link
                  href="/jobs/engineering/salary/150k-plus"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  $150K+ Jobs
                </Link>
              </li>
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
                  href="/companies-hiring-worldwide"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Companies Hiring Worldwide
                </Link>
              </li>
              <li>
                <Link
                  href="/companies"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  All Companies
                </Link>
              </li>
              <li>
                <Link
                  href="/blog"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Career Blog
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
