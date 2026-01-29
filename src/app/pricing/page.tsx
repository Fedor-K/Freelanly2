import { Metadata } from 'next';
import { Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';
import { PricingCards } from './PricingCards';
import { SenjaWidget } from '@/components/ui/SenjaWidget';

export const metadata: Metadata = {
  title: 'Pricing - Premium Plans for Job Seekers',
  description: 'Get unlimited access to all jobs, full salary insights, and instant alerts. Weekly, monthly, and annual plans available.',
  keywords: ['freelanly pricing', 'job board pricing', 'remote jobs subscription'],
  openGraph: {
    title: 'Freelanly Pricing - Premium Plans',
    description: 'Unlimited job views and full salary insights for serious job seekers.',
    url: `${siteConfig.url}/pricing`,
  },
  alternates: {
    canonical: `${siteConfig.url}/pricing`,
  },
};

export default function PricingPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Pricing',
    description: 'Freelanly pricing plans for job seekers',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${siteConfig.url}/pricing` },
      ],
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-16">
          {/* Header */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold mb-3 sm:mb-4">
              Stop Applying Into the Void
            </h1>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-2 sm:px-0">
              Get direct contact info, apply before the crowd, and actually hear back.
              Cancel anytime — but you won't want to.
            </p>
          </div>

          {/* Urgency Banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 max-w-2xl mx-auto">
            <p className="text-center text-sm text-orange-800">
              <span className="font-semibold">⚡ Jobs move fast.</span> The average remote position gets 250+ applications.
              Early applicants are <strong>8x more likely</strong> to get interviews.
            </p>
          </div>

          {/* Social Proof Stats */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-6 mb-8 sm:mb-12 text-sm px-2 sm:px-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span><strong>800+</strong> professionals upgraded this month</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <span>Average time to first interview: <strong>8 days</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔒</span>
              <span><strong>Secure payment</strong> via Stripe</span>
            </div>
          </div>

          {/* Plans */}
          <Suspense fallback={<div className="text-center py-8">Loading plans...</div>}>
            <PricingCards />
          </Suspense>

          {/* Testimonials - Senja Widget */}
          <section className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              What Our Members Say
            </h2>
            <SenjaWidget />
          </section>

          {/* Features comparison */}
          <section className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-2">
              Free vs Premium: What's the Difference?
            </h2>
            <p className="text-center text-muted-foreground mb-8">
              Free lets you browse. Premium lets you <strong>actually apply</strong>.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold mb-4 text-muted-foreground">Free — Window Shopping</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Browse all job listings
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Save jobs to review later
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Basic salary info (average only)
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Daily digest emails
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-red-400">✗</span>
                    Can't see contact info
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-red-400">✗</span>
                    Can't apply to jobs
                  </li>
                </ul>
              </div>
              <div className="border-2 border-primary rounded-lg p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-bl-lg font-medium">
                  Get Hired
                </div>
                <h3 className="font-semibold mb-4 text-primary">Premium — Actually Apply</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Everything in Free, plus...
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <strong>Direct contact info</strong> — email hiring managers
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <strong>Apply with one click</strong> — skip the ATS
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <strong>Instant alerts</strong> — be first to new jobs
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Full salary data (know your worth)
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Application tracking
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Can I cancel my subscription anytime?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Yes, you can cancel anytime. You'll continue to have Premium access until the end of your billing period.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What payment methods do you accept?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  We accept all major credit and debit cards (Visa, Mastercard, American Express) through Stripe. PayPal and Apple Pay are also supported.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Which plan should I choose?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Most job searches take 1-3 months. We recommend the Quarterly plan for the best value. If you need quick access, start with Monthly and upgrade anytime.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What happens after I subscribe?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  You get instant access to all Premium features: apply to unlimited jobs, see full salary data, and get priority job alerts. Start applying right away!
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Do you offer refunds?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  We offer refunds on a case-by-case basis. If you're not satisfied, contact us within 7 days of your payment and we'll work something out.
                </p>
              </details>
            </div>
          </section>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'Can I cancel my subscription anytime?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes, you can cancel anytime. You\'ll continue to have Premium access until the end of your billing period.',
                },
              },
              {
                '@type': 'Question',
                name: 'Which plan should I choose?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Most job searches take 1-3 months. We recommend the Quarterly plan for the best value.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
