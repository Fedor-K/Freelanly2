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
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">
              Find Your Next Remote Job Faster
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Get unlimited access to all jobs, full salary insights, and apply directly.
              Cancel anytime.
            </p>
          </div>

          {/* Social Proof Stats */}
          <div className="flex flex-wrap justify-center gap-6 mb-12 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚡</span>
              <span><strong>800+</strong> professionals upgraded this month</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📅</span>
              <span>Average time to first interview: <strong>8 days</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🛡️</span>
              <span><strong>100% money-back</strong> guarantee</span>
            </div>
          </div>

          {/* Plans */}
          <PricingCards />

          {/* Testimonials */}
          <section className="mt-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">
              What Our Members Say
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500">★</span>)}
                </div>
                <p className="text-sm mb-4">
                  &quot;Got 3 interview calls in my first week. The direct contact info is a game changer - no more applying into the void.&quot;
                </p>
                <p className="text-sm font-medium">Michael R.</p>
                <p className="text-xs text-muted-foreground">Senior Developer, now at Shopify</p>
              </div>
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500">★</span>)}
                </div>
                <p className="text-sm mb-4">
                  &quot;Finally a job board that helps you actually get hired. The salary insights helped me negotiate 20% higher than the initial offer.&quot;
                </p>
                <p className="text-sm font-medium">Sarah K.</p>
                <p className="text-xs text-muted-foreground">Product Manager, Remote</p>
              </div>
              <div className="border rounded-lg p-6 bg-muted/30">
                <div className="flex items-center gap-1 mb-3">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-yellow-500">★</span>)}
                </div>
                <p className="text-sm mb-4">
                  &quot;Landed my dream remote job within 2 weeks. The weekly plan was perfect for my urgent job search. Worth every penny.&quot;
                </p>
                <p className="text-sm font-medium">Alex M.</p>
                <p className="text-xs text-muted-foreground">Frontend Engineer, EU Remote</p>
              </div>
            </div>
          </section>

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
