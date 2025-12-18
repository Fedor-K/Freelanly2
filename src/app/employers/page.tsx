import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Post Remote Jobs - Hire Top Remote Talent | Freelanly for Employers',
  description: 'Post your remote job openings and reach thousands of qualified candidates. Free job posting, ATS integration, and applicant tracking.',
  keywords: [
    'post remote jobs',
    'hire remote developers',
    'remote job posting',
    'hire remote workers',
    'post job openings',
  ],
  openGraph: {
    title: 'Hire Remote Talent - Post Jobs on Freelanly',
    description: 'Reach thousands of remote job seekers. Post your openings today.',
    url: `${siteConfig.url}/employers`,
  },
  alternates: {
    canonical: `${siteConfig.url}/employers`,
  },
};

const features = [
  {
    icon: '🎯',
    title: 'Targeted Reach',
    description: 'Your job posts reach thousands of pre-qualified remote professionals actively seeking opportunities.',
  },
  {
    icon: '🔗',
    title: 'LinkedIn Integration',
    description: 'We automatically import your LinkedIn hiring posts and structure them for better visibility.',
  },
  {
    icon: '📊',
    title: 'Application Tracking',
    description: 'Track opens, clicks, and responses. Know which candidates are most engaged.',
  },
  {
    icon: '🚀',
    title: 'Fast Indexing',
    description: 'Jobs appear on Google within hours through our Indexing API integration.',
  },
  {
    icon: '📧',
    title: 'Direct Applications',
    description: 'Receive applications directly to your inbox. No middleman, no delays.',
  },
  {
    icon: '💰',
    title: 'Free to Start',
    description: 'Post your first job for free. Upgrade for premium placement and features.',
  },
];

const stats = [
  { value: '50K+', label: 'Monthly Job Seekers' },
  { value: '1000+', label: 'Active Jobs' },
  { value: '15min', label: 'Avg. Time to First Apply' },
  { value: '85%', label: 'Response Rate' },
];

export default function EmployersPage() {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Post Remote Jobs - Freelanly for Employers',
    description: 'Post remote job openings and hire top talent',
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
        { '@type': 'ListItem', position: 2, name: 'Employers', item: `${siteConfig.url}/employers` },
      ],
    },
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="container py-16 md:py-24 text-center">
          <Badge className="mb-4" variant="secondary">
            For Employers
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Hire Top Remote Talent
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Post your job openings and reach thousands of qualified remote professionals.
            Get applications directly to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <a href="mailto:employers@freelanly.com?subject=Post a Job">
                Post a Job - Free
              </a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#pricing">View Pricing</Link>
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y bg-muted/30">
          <div className="container py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <div className="text-3xl md:text-4xl font-bold text-primary">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container py-16">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Post on Freelanly?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <span className="text-2xl">{feature.icon}</span>
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works */}
        <section className="border-y bg-muted/30">
          <div className="container py-16">
            <h2 className="text-3xl font-bold text-center mb-12">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-2">Submit Your Job</h3>
                <p className="text-sm text-muted-foreground">
                  Email us your job details or post on LinkedIn with #hiring.
                  We'll extract and structure the information.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-2">Get Indexed</h3>
                <p className="text-sm text-muted-foreground">
                  Your job appears on our site and Google within hours.
                  We notify relevant job seekers via alerts.
                </p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-2">Receive Applications</h3>
                <p className="text-sm text-muted-foreground">
                  Candidates apply directly. Track engagement and hire your perfect match.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container py-16">
          <h2 className="text-3xl font-bold text-center mb-4">
            Simple Pricing
          </h2>
          <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
            Start for free. Upgrade for premium features and better placement.
          </p>

          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Free */}
            <Card>
              <CardHeader>
                <CardTitle>Free</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$0</span>
                  <span className="text-muted-foreground">/job</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> 1 active job posting
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Basic listing
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Email applications
                  </li>
                  <li className="flex items-center gap-2 text-muted-foreground">
                    <span className="h-4 w-4">✗</span> Featured placement
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild>
                  <a href="mailto:employers@freelanly.com?subject=Free Job Post">
                    Get Started
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-primary relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
              <CardHeader>
                <CardTitle>Pro</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">$99</span>
                  <span className="text-muted-foreground">/job/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> 5 active jobs
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Featured placement
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Social media boost
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Application analytics
                  </li>
                </ul>
                <Button className="w-full" asChild>
                  <a href="mailto:employers@freelanly.com?subject=Pro Job Posting">
                    Contact Us
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Enterprise */}
            <Card>
              <CardHeader>
                <CardTitle>Enterprise</CardTitle>
                <div className="mt-4">
                  <span className="text-3xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm mb-6">
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Unlimited jobs
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> ATS integration
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> Dedicated support
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-green-500" /> API access
                  </li>
                </ul>
                <Button className="w-full" variant="outline" asChild>
                  <a href="mailto:enterprise@freelanly.com?subject=Enterprise Inquiry">
                    Contact Sales
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <section className="container py-16">
          <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Find Your Next Hire?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
              Join hundreds of companies hiring top remote talent through Freelanly.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <a href="mailto:employers@freelanly.com?subject=I want to post a job">
                Post Your First Job Free
              </a>
            </Button>
          </div>
        </section>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
