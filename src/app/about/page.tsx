import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'About Freelanly - Remote Jobs Platform',
  description: 'Learn about Freelanly, the remote job aggregation platform. We collect job postings from LinkedIn, company career pages, and more to help you find your dream remote position.',
  alternates: {
    canonical: `${siteConfig.url}/about`,
  },
  openGraph: {
    title: 'About Freelanly - Remote Jobs Platform',
    description: 'Learn about Freelanly, the remote job aggregation platform.',
    url: `${siteConfig.url}/about`,
    type: 'website',
  },
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-12">
          {/* Breadcrumb */}
          <nav className="mb-8 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {' / '}
            <span className="text-foreground">About</span>
          </nav>

          {/* Hero */}
          <section className="max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-4xl font-bold mb-6">About Freelanly</h1>
            <p className="text-xl text-muted-foreground">
              We're on a mission to make finding remote work easier by aggregating
              job postings from across the internet and presenting them in one place.
            </p>
          </section>

          {/* Mission */}
          <section className="max-w-4xl mx-auto mb-16">
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🎯</span> Our Mission
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  <p>
                    Finding remote jobs shouldn't require checking dozens of job boards.
                    We aggregate opportunities from LinkedIn posts, company career pages,
                    and popular job boards so you can find your next role in one place.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span> AI-Powered Extraction
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">
                  <p>
                    We use AI to extract structured information from job posts,
                    including salary ranges, requirements, and benefits. This means
                    you get consistent, comparable data across all listings.
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* How We Work */}
          <section className="max-w-4xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-8 text-center">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-2">We Aggregate</h3>
                <p className="text-sm text-muted-foreground">
                  Our systems continuously monitor LinkedIn, job boards, and company
                  career pages for new remote opportunities.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-2">AI Extracts</h3>
                <p className="text-sm text-muted-foreground">
                  We use DeepSeek AI to extract job details like salary, requirements,
                  and benefits from unstructured job posts.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-2">You Apply</h3>
                <p className="text-sm text-muted-foreground">
                  Browse, filter, and apply directly. PRO members get full access
                  to contact information and unlimited applications.
                </p>
              </div>
            </div>
          </section>

          {/* Stats */}
          <section className="max-w-4xl mx-auto mb-16">
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="py-8">
                <div className="grid md:grid-cols-4 gap-8 text-center">
                  <div>
                    <div className="text-4xl font-bold">1000+</div>
                    <div className="text-sm opacity-80">Active Jobs</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold">500+</div>
                    <div className="text-sm opacity-80">Companies</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold">21</div>
                    <div className="text-sm opacity-80">Categories</div>
                  </div>
                  <div>
                    <div className="text-4xl font-bold">50+</div>
                    <div className="text-sm opacity-80">Countries</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Contact */}
          <section className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">Get in Touch</h2>
            <p className="text-muted-foreground mb-6">
              Have questions or feedback? We'd love to hear from you.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild>
                <a href="mailto:info@freelanly.com">Contact Us</a>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/jobs">Browse Jobs</Link>
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-8">
              Email: <a href="mailto:info@freelanly.com" className="text-primary hover:underline">info@freelanly.com</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />

      {/* Organization Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            mainEntity: {
              '@type': 'Organization',
              name: 'Freelanly',
              url: siteConfig.url,
              description: 'Remote job aggregation platform that collects job postings from LinkedIn, company career pages, and more.',
              foundingDate: '2024',
              contactPoint: {
                '@type': 'ContactPoint',
                email: 'info@freelanly.com',
                contactType: 'customer service',
              },
              sameAs: [
                siteConfig.links.twitter,
                siteConfig.links.github,
              ],
            },
          }),
        }}
      />
    </div>
  );
}
