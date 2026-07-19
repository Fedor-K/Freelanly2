import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';
import { SEO_NICHES, matchesNiche } from '@/config/seo-niches';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Remote Jobs & Freelance Projects by Role — Freelanly',
  description: 'Browse fresh remote roles and freelance projects by profession — engineering, DevOps, data, design, product — pulled from LinkedIn hiring posts and career pages every few hours.',
  alternates: { canonical: `${siteConfig.url}/remote-jobs` },
};

export default async function RemoteJobsHub() {
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const allCats = [...new Set(SEO_NICHES.flatMap((n) => n.categorySlugs))];
  const pool = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: monthAgo },
      OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }],
      category: { slug: { in: allCats } },
    },
    select: { title: true, skills: true, category: { select: { slug: true } } },
  });
  const rows = pool.map((o) => ({ title: o.title, skills: o.skills, categorySlug: o.category?.slug ?? null }));
  const counts = new Map(SEO_NICHES.map((n) => [n.slug, rows.filter((r) => matchesNiche(r, n)).length]));
  const niches = [...SEO_NICHES].sort((a, b) => (counts.get(b.slug)! - counts.get(a.slug)!));

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Remote Jobs & Freelance Projects by Role',
    url: `${siteConfig.url}/remote-jobs`,
    hasPart: niches.map((n) => ({ '@type': 'WebPage', name: n.label, url: `${siteConfig.url}/remote-jobs/${n.slug}` })),
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <MarketingNav />
      <main className="pt-32 pb-8">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Remote jobs</span>
          <h1 className="text-[clamp(32px,4.5vw,54px)] font-semibold tracking-tighter mt-4 mb-5">
            Fresh remote roles, <span className="text-[#C7F94A]">by profession.</span>
          </h1>
          <p className="text-[#D4D4D8] text-lg max-w-[64ch] mb-14">
            Real hiring posts and career-page drops, caught hours before they hit the big boards and matched
            to your profile. Pick your role — each page is a live feed, updated every few hours.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {niches.map((n) => (
              <Link
                key={n.slug}
                href={`/remote-jobs/${n.slug}`}
                className="block rounded-2xl p-6 border transition-colors hover:border-[#C7F94A]/50"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{n.label}</h2>
                  <span className="text-[12px] font-mono text-[#C7F94A]">{counts.get(n.slug)} live</span>
                </div>
                <p className="text-[13px] text-[#A1A1AA]">{n.seoDesc}</p>
                <span className="inline-block mt-3 text-[13px] text-[#C7F94A]">Browse {n.label} roles →</span>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
