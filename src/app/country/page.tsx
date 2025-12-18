import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Card, CardContent } from '@/components/ui/card';
import { siteConfig, countries, jobRoles } from '@/config/site';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Remote Jobs by Country - Find Work From Home Jobs Worldwide | Freelanly',
  description: 'Browse remote jobs by country. Find work from home opportunities in USA, UK, Germany, Canada, Australia and more. Apply to companies hiring remotely.',
  keywords: [
    'remote jobs by country',
    'work from home worldwide',
    'international remote jobs',
    'global remote work',
    'remote jobs usa',
    'remote jobs europe',
  ],
  openGraph: {
    title: 'Remote Jobs by Country',
    description: 'Find remote work opportunities in your country. Browse jobs from top companies hiring remotely.',
    url: `${siteConfig.url}/country`,
    siteName: siteConfig.name,
  },
  alternates: {
    canonical: `${siteConfig.url}/country`,
  },
};

export default async function CountriesPage() {
  // Get job counts by country
  let countryCounts: Record<string, number> = {};

  try {
    const counts = await prisma.job.groupBy({
      by: ['country'],
      where: { isActive: true },
      _count: true,
    });

    counts.forEach((c) => {
      if (c.country) {
        countryCounts[c.country] = c._count;
      }
    });
  } catch (error) {
    console.error('Failed to fetch country counts:', error);
  }

  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
          { '@type': 'ListItem', position: 2, name: 'Countries', item: `${siteConfig.url}/country` },
        ],
      },
      {
        '@type': 'ItemList',
        name: 'Remote Jobs by Country',
        numberOfItems: countries.length,
        itemListElement: countries.map((country, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${siteConfig.url}/country/${country.slug}`,
          name: `Remote Jobs in ${country.name}`,
        })),
      },
    ],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">Countries</li>
            </ol>
          </nav>

          {/* Page Header */}
          <header className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Remote Jobs by Country</h1>
            <p className="text-muted-foreground">
              Find remote work opportunities tailored to your location. Browse jobs from companies hiring in your country.
            </p>
          </header>

          {/* Countries Grid */}
          <section className="mb-12">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {countries.map((country) => {
                const jobCount = country.code ? countryCounts[country.code] || 0 : Object.values(countryCounts).reduce((a, b) => a + b, 0);

                return (
                  <Link key={country.slug} href={`/country/${country.slug}`}>
                    <Card className="h-full hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{country.flag}</span>
                          <div>
                            <h2 className="font-semibold">{country.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              {jobCount} {jobCount === 1 ? 'job' : 'jobs'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Popular Roles by Country */}
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">Popular Roles by Country</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {countries.slice(0, 6).map((country) => (
                <Card key={country.slug}>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">
                      {country.flag} {country.name}
                    </h3>
                    <div className="space-y-1">
                      {jobRoles.slice(0, 5).map((role) => (
                        <Link
                          key={role.slug}
                          href={`/country/${country.slug}/jobs/${role.slug}`}
                          className="block text-sm text-muted-foreground hover:text-foreground"
                        >
                          {role.name} Jobs →
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* SEO Content */}
          <section className="border-t pt-8">
            <h2 className="text-2xl font-bold mb-4">Find Remote Work Anywhere</h2>
            <div className="prose prose-sm max-w-none text-muted-foreground">
              <p>
                Remote work opportunities are available worldwide. Whether you&apos;re based in the United States,
                Europe, or anywhere else, you can find jobs from companies that embrace remote-first culture.
              </p>
              <p>
                Freelanly aggregates remote job postings from LinkedIn and top tech companies, making it easy
                to find positions that match your location preferences. Filter by country to see jobs
                that are specifically looking for candidates in your region.
              </p>
              <p>
                Many companies now hire globally, offering competitive salaries regardless of your location.
                Browse our country-specific job listings to find opportunities that work for you.
              </p>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}
