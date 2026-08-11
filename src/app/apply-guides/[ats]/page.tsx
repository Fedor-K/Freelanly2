import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/config/site';
import { truncateTitle, truncateDescription } from '@/lib/seo';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';
import { ATS_GUIDES, getGuide } from '../guides-data';

export function generateStaticParams() {
  return ATS_GUIDES.map((g) => ({ ats: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ ats: string }> }): Promise<Metadata> {
  const { ats } = await params;
  const guide = getGuide(ats);
  if (!guide) return {};
  return {
    title: truncateTitle(guide.title),
    description: truncateDescription(guide.metaDescription),
    alternates: { canonical: `${siteConfig.url}/apply-guides/${guide.slug}` },
  };
}

export default async function AtsGuidePage({ params }: { params: Promise<{ ats: string }> }) {
  const { ats } = await params;
  const guide = getGuide(ats);
  if (!guide) notFound();

  const url = `${siteConfig.url}/apply-guides/${guide.slug}`;

  const howToJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: guide.title,
    description: guide.metaDescription,
    step: guide.steps.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guide.faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
      { '@type': 'ListItem', position: 2, name: 'Apply Guides', item: `${siteConfig.url}/apply-guides` },
      { '@type': 'ListItem', position: 3, name: guide.ats, item: url },
    ],
  };

  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <MarketingNav />

      <main className="pt-32 pb-8">
        <article className="max-w-[760px] mx-auto px-8">
          {/* Breadcrumbs */}
          <nav className="text-[13px] text-[#6B7280] mb-8">
            <Link href="/" className="hover:text-[#C7F94A]">Home</Link>
            <span className="mx-2">/</span>
            <Link href="/apply-guides" className="hover:text-[#C7F94A]">Apply Guides</Link>
            <span className="mx-2">/</span>
            <span className="text-[#A1A1AA]">{guide.ats}</span>
          </nav>

          <h1 className="text-[clamp(30px,4vw,44px)] font-semibold tracking-tighter mb-6 leading-tight">
            {guide.title}
          </h1>

          {/* URL recognition box */}
          <div
            className="rounded-xl p-5 mb-8 font-mono text-[13px]"
            style={{ background: 'rgba(199,249,74,0.06)', border: '1px solid rgba(199,249,74,0.2)' }}
          >
            <div className="text-[11px] tracking-widest uppercase text-[#6B7280] mb-2">How to recognize {guide.ats}</div>
            {guide.urlPatterns.map((p) => (
              <div key={p} className="text-[#C7F94A]">{p}</div>
            ))}
          </div>

          <p className="text-[#D4D4D8] text-lg leading-relaxed mb-12">{guide.intro}</p>

          {/* Field-by-field walkthrough */}
          <h2 className="text-2xl font-semibold tracking-tight mb-6">The form, field by field</h2>
          <ol className="space-y-6 mb-14">
            {guide.steps.map((s, i) => (
              <li key={s.name} className="flex gap-4">
                <span
                  className="shrink-0 w-8 h-8 rounded-full grid place-items-center font-mono text-[13px] font-bold"
                  style={{ background: 'rgba(199,249,74,0.12)', color: '#C7F94A' }}
                >
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold mb-1">{s.name}</h3>
                  <p className="text-[15px] text-[#A1A1AA] leading-relaxed">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Mistakes */}
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Mistakes that get applications rejected</h2>
          <ul className="space-y-3 mb-14">
            {guide.mistakes.map((m) => (
              <li key={m} className="flex gap-3 text-[15px] text-[#D4D4D8]">
                <span className="text-[#F87171] shrink-0">✕</span>
                <span>{m}</span>
              </li>
            ))}
          </ul>

          {/* Product bridge — honest, no extension mention */}
          <div
            className="rounded-2xl p-7 mb-14"
            style={{ background: 'rgba(199,249,74,0.05)', border: '1px solid rgba(199,249,74,0.18)' }}
          >
            <h2 className="text-xl font-semibold mb-2">The letter is the hard part — draft it with AI</h2>
            <p className="text-[15px] text-[#A1A1AA] mb-5 leading-relaxed">
              Freelanly finds fresh remote tech roles matched to your profile and drafts a tailored
              cover letter for each — checked by a second AI reviewer against the job&apos;s requirements. You review,
              edit, and send every application yourself. First three are free.
            </p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full font-semibold text-[14px]"
              style={{ background: '#C7F94A', color: '#0A0B0F' }}
            >
              Try the AI application assistant →
            </Link>
          </div>

          {/* FAQ */}
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Frequently asked questions</h2>
          <div className="space-y-6 mb-14">
            {guide.faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold mb-1.5">{f.q}</h3>
                <p className="text-[15px] text-[#A1A1AA] leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>

          {/* Other guides */}
          <h2 className="text-lg font-semibold mb-4">Other ATS guides</h2>
          <div className="flex flex-wrap gap-3 mb-6">
            {ATS_GUIDES.filter((g) => g.slug !== guide.slug).map((g) => (
              <Link
                key={g.slug}
                href={`/apply-guides/${g.slug}`}
                className="px-4 py-2 rounded-full text-[14px] border hover:border-[#C7F94A]/50 transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.14)', color: '#D4D4D8' }}
              >
                {g.ats} →
              </Link>
            ))}
          </div>
        </article>
      </main>

      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
