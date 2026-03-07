import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig, categories } from '@/config/site';

export const metadata: Metadata = {
  title: 'Freelance Projects - Direct Client Projects from LinkedIn',
  description: 'Browse freelance projects sourced directly from LinkedIn. Find direct client opportunities in translation, engineering, design, and more. Updated daily.',
  openGraph: {
    title: 'Freelance Projects - Direct Client Opportunities',
    description: 'Browse freelance projects sourced directly from LinkedIn. Find direct client opportunities updated daily.',
    url: `${siteConfig.url}/freelance`,
    siteName: siteConfig.name,
  },
  alternates: {
    canonical: `${siteConfig.url}/freelance`,
  },
};

const groupLabels: Record<string, string> = {
  tech: 'Tech',
  business: 'Business',
  content: 'Content & Creative',
  other: 'Other',
};

export default function FreelancePage() {
  const groups = ['tech', 'business', 'content', 'other'];

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">Freelance Projects</h1>
            <p className="text-muted-foreground text-sm">
              Direct client projects from LinkedIn
            </p>
          </div>

          {/* Categories by group */}
          <div className="space-y-8">
            {groups.map((group) => {
              const groupCats = categories.filter((c) => c.group === group);
              return (
                <div key={group}>
                  <h2 className="text-lg font-semibold mb-3">{groupLabels[group]}</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {groupCats.map((cat) => (
                      <Link
                        key={cat.slug}
                        href={`/freelance/${cat.slug}`}
                        className="flex items-center gap-2 px-4 py-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <span>{cat.icon}</span>
                        <span className="text-sm font-medium">{cat.name}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Freelance Projects', item: `${siteConfig.url}/freelance` },
            ],
          }),
        }}
      />
    </div>
  );
}
