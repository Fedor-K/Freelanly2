import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';
import { ATS_GUIDES } from './guides-data';

export const metadata: Metadata = {
  title: 'ATS Application Guides — Lever, Greenhouse, Ashby, Workable',
  description:
    'Field-by-field guides to the application forms of the major ATS platforms: what every field is for, what gets applications auto-rejected, and how to stand out.',
  alternates: { canonical: `${siteConfig.url}/apply-guides` },
};

const collectionJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: 'ATS Application Guides',
  description: 'Practical guides to filling out job application forms on Lever, Greenhouse, Ashby, and Workable.',
  url: `${siteConfig.url}/apply-guides`,
  hasPart: ATS_GUIDES.map((g) => ({
    '@type': 'Article',
    headline: g.title,
    url: `${siteConfig.url}/apply-guides/${g.slug}`,
  })),
};

export default function ApplyGuidesHub() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }} />
      <MarketingNav />
      <main className="pt-32 pb-8">
        <div className="max-w-[900px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Apply guides</span>
          <h1 className="text-[clamp(34px,4.5vw,54px)] font-semibold tracking-tighter mt-4 mb-5">
            Every ATS application form, <span className="text-[#C7F94A]">explained.</span>
          </h1>
          <p className="text-[#D4D4D8] text-lg max-w-[62ch] mb-14">
            Most rejections happen before a human reads your application — a mis-parsed resume, a skipped
            knock-out question, a broken portfolio link. These guides walk the actual application form of each
            major applicant tracking system, field by field.
          </p>

          <div className="grid md:grid-cols-2 gap-5 mb-8">
            {ATS_GUIDES.map((g) => (
              <Link
                key={g.slug}
                href={`/apply-guides/${g.slug}`}
                className="block rounded-2xl p-7 border transition-colors hover:border-[#C7F94A]/50"
                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="font-mono text-[11px] tracking-widest uppercase text-[#6B7280] mb-3">
                  {g.urlPatterns[0].split('/')[0]}
                </div>
                <h2 className="text-xl font-semibold mb-2">{g.ats} application form</h2>
                <p className="text-[14px] text-[#A1A1AA] mb-4">
                  {g.steps.length} fields explained · {g.mistakes.length} auto-reject mistakes · FAQ
                </p>
                <span className="text-[14px] text-[#C7F94A]">Read the guide →</span>
              </Link>
            ))}
          </div>

          <p className="text-[14px] text-[#6B7280] max-w-[62ch]">
            Written and maintained by the Freelanly team. Freelanly is a personal AI assistant for vacancies and
            projects application — it finds matched openings and drafts the cover letter, and you review and send.
          </p>
        </div>
      </main>
      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
