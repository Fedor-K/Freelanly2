import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';
import { SEO_NICHES, getNiche, matchesNiche } from '@/config/seo-niches';
import { NicheFeed, type NicheCard } from './NicheFeed';

export const revalidate = 3600; // ISR: regenerate hourly — matches the "updated every few hours" claim, keeps the page fast

export function generateStaticParams() {
  return SEO_NICHES.map((n) => ({ niche: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ niche: string }> }): Promise<Metadata> {
  const niche = getNiche((await params).niche);
  if (!niche) return {};
  const url = `${siteConfig.url}/remote-jobs/${niche.slug}`;
  return {
    title: niche.seoTitle,
    description: niche.seoDesc,
    alternates: { canonical: url },
    openGraph: { title: niche.seoTitle, description: niche.seoDesc, url, type: 'website' },
  };
}

async function fetchNicheCards(niche: ReturnType<typeof getNiche>): Promise<NicheCard[]> {
  if (!niche) return [];
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const pool = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: monthAgo },
      OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }],
      category: { slug: { in: niche.categorySlugs } },
    },
    select: {
      id: true, slug: true, title: true, skills: true, location: true, country: true,
      level: true, createdAt: true, clientName: true, posterCompany: true,
      company: { select: { name: true } }, category: { select: { slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 400,
  });
  return pool
    .filter((o) => matchesNiche({ title: o.title, skills: o.skills, categorySlug: o.category?.slug ?? null }, niche))
    .slice(0, 90)
    .map((o) => ({
      slug: o.slug,
      title: o.title,
      company: o.company?.name || o.posterCompany || o.clientName || 'Company',
      location: o.location || o.country || 'Remote',
      level: o.level,
      skills: o.skills.slice(0, 6),
      createdAt: o.createdAt.toISOString(),
    }));
}

export default async function NichePage({ params }: { params: Promise<{ niche: string }> }) {
  const niche = getNiche((await params).niche);
  if (!niche) notFound();
  const cards = await fetchNicheCards(niche);

  const related = SEO_NICHES.filter((n) => n.slug !== niche.slug).slice(0, 8);
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: niche.seoTitle,
    description: niche.seoDesc,
    url: `${siteConfig.url}/remote-jobs/${niche.slug}`,
    // No JobPosting items: our salaries are formula-estimated, so emitting JobPosting structured
    // data would violate Google's policy (and our honesty canon). Just the collection.
  };
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Remote jobs', item: `${siteConfig.url}/remote-jobs` },
      { '@type': 'ListItem', position: 2, name: niche.label, item: `${siteConfig.url}/remote-jobs/${niche.slug}` },
    ],
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <MarketingNav />
      <main className="pt-32 pb-8">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-8">
          {/* Breadcrumb */}
          <nav className="text-[12px] text-[#6B7280] mb-6 font-mono">
            <Link href="/remote-jobs" className="hover:text-[#C7F94A]">Remote jobs</Link>
            <span className="mx-2">→</span>
            <span className="text-[#A1A1AA]">{niche.label}</span>
          </nav>

          {/* Hero */}
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— {niche.label}</span>
          <h1 className="text-[clamp(30px,4.2vw,50px)] font-semibold tracking-tighter mt-4 mb-4">{niche.h1}</h1>
          <div className="flex items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-2 text-[13px] text-[#C7F94A]">
              <span className="w-2 h-2 rounded-full bg-[#C7F94A] animate-pulse" />
              {cards.length} live now · updated every few hours
            </span>
          </div>
          <p className="text-[#D4D4D8] text-[16px] leading-relaxed max-w-[64ch] mb-7">{niche.intro}</p>
          <div className="flex flex-wrap gap-3 mb-12">
            <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-[15px]" style={{ background: '#C7F94A', color: '#0A0B0F' }}>
              Start free — get matched →
            </Link>
            <Link href="/how-it-works" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-[15px] border" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
              How it works
            </Link>
          </div>

          {/* Live filtered feed (client) */}
          <NicheFeed cards={cards} label={niche.label} />

          {/* Related niches — internal linking */}
          <div className="mt-16 pt-10 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="font-mono text-[11px] tracking-widest uppercase text-[#6B7280] mb-4">More remote roles</div>
            <div className="flex flex-wrap gap-2.5">
              {related.map((n) => (
                <Link key={n.slug} href={`/remote-jobs/${n.slug}`} className="px-4 py-2 rounded-full text-[13px] border hover:border-[#C7F94A]/50 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.12)', color: '#D4D4D8' }}>
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
