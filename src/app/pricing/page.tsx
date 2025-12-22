import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';
import { PricingCards } from './PricingCards';

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
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">
              Find Your Next Remote Job Faster
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get unlimited access to all jobs, full salary insights, and apply directly.
              Start with a 7-day free trial.
            </p>
          </div>

          {/* Plans */}
          <PricingCards />

          {/* Features comparison */}
          <section className="mt-20 max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              What You Get with Premium
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold mb-4 text-muted-foreground">Free</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Browse all job listings
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Save unlimited jobs
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Basic salary insights (average only)
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Daily email alerts
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span>✗</span>
                    Full salary range & percentiles
                  </li>
                  <li className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span>✗</span>
                    Apply to jobs
                  </li>
                </ul>
              </div>
              <div className="border-2 border-primary rounded-lg p-6">
                <h3 className="font-semibold mb-4 text-primary">Premium</h3>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Everything in Free
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <strong>Full salary insights</strong> (range, percentiles, source)
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <strong>Apply to jobs directly</strong>
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Instant email alerts
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Application tracking
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    Priority support
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
                  How does the 7-day free trial work?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Monthly and Annual plans include a 7-day free trial. You won't be charged until the trial ends. Cancel anytime during the trial and you won't be charged at all.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Why is there no trial on the Weekly plan?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  The Weekly plan is designed for quick, urgent job searches. At €10 for a full week of access, it's already a low-commitment option to try Premium features.
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
                name: 'How does the 7-day free trial work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Monthly and Annual plans include a 7-day free trial. Cancel anytime during the trial and you won\'t be charged.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
