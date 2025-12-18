import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pricing - Free & Pro Plans for Job Seekers',
  description: 'Choose the plan that fits your job search. Free tier with 20 job views/day or Pro at $19/month for unlimited access and email tracking.',
  keywords: ['freelanly pricing', 'job board pricing', 'remote jobs subscription'],
  openGraph: {
    title: 'Freelanly Pricing - Free & Pro Plans',
    description: 'Unlimited job views and email tracking for serious job seekers.',
    url: `${siteConfig.url}/pricing`,
  },
  alternates: {
    canonical: `${siteConfig.url}/pricing`,
  },
};

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for casual job browsing',
    features: [
      '20 job views per day',
      '5 applications per month',
      'Basic job search',
      'Access to LinkedIn posts',
      'Limited salary data',
    ],
    limitations: [
      'No email tracking',
      'No saved searches',
      'Limited filters',
    ],
    cta: 'Get Started',
    href: '/jobs',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: 'per month',
    description: 'For serious job seekers',
    features: [
      'Unlimited job views',
      '100 applications per month',
      'Advanced search & filters',
      'Full salary insights',
      'Email tracking (opens, clicks)',
      'Saved job searches',
      'Priority support',
      'Early access to new features',
    ],
    limitations: [],
    cta: 'Start Pro Trial',
    href: '/signup?plan=pro',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'per month',
    description: 'For teams and recruiters',
    features: [
      'Everything in Pro',
      'Unlimited applications',
      'Team collaboration',
      'API access',
      'Custom integrations',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    limitations: [],
    cta: 'Contact Sales',
    href: 'mailto:sales@freelanly.com',
    popular: false,
  },
];

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
              Simple, Transparent Pricing
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start for free, upgrade when you need more power for your job search.
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${plan.popular ? 'border-primary shadow-lg scale-105' : ''}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {plan.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5">✓</span>
                        {feature}
                      </li>
                    ))}
                    {plan.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-0.5">✗</span>
                        {limitation}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? 'default' : 'outline'}
                    asChild
                  >
                    <Link href={plan.href}>{plan.cta}</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

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
                  Yes, you can cancel your Pro subscription at any time. You'll continue to have access until the end of your billing period.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What payment methods do you accept?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  We accept all major credit cards (Visa, Mastercard, American Express) through our secure payment processor, Stripe.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  Do you offer refunds?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  We offer a 7-day money-back guarantee for Pro subscriptions. If you're not satisfied, contact us for a full refund.
                </p>
              </details>
              <details className="border rounded-lg p-4">
                <summary className="font-medium cursor-pointer">
                  What is email tracking?
                </summary>
                <p className="mt-2 text-muted-foreground">
                  Email tracking lets you know when employers open your application emails. This helps you follow up at the right time.
                </p>
              </details>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-16 text-center">
            <h2 className="text-2xl font-bold mb-4">
              Ready to find your next remote job?
            </h2>
            <p className="text-muted-foreground mb-6">
              Join thousands of professionals who found their dream position through Freelanly.
            </p>
            <Button size="lg" asChild>
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
          </section>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* FAQ Schema */}
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
                  text: 'Yes, you can cancel your Pro subscription at any time.',
                },
              },
              {
                '@type': 'Question',
                name: 'What payment methods do you accept?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'We accept all major credit cards through Stripe.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do you offer refunds?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'We offer a 7-day money-back guarantee for Pro subscriptions.',
                },
              },
            ],
          }),
        }}
      />
    </div>
  );
}
