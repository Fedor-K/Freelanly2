import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { categories } from '@/config/site';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="container py-24 text-center">
          <Badge className="mb-4" variant="secondary">
            1,000+ Remote Jobs Updated Daily
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Find Remote Jobs from
            <br />
            <span className="text-primary">LinkedIn & Top Companies</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            We aggregate hiring posts from LinkedIn and job boards,
            extract the details, and let you apply directly via email.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/jobs">Browse Jobs</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/pricing">Get Pro Access</Link>
            </Button>
          </div>
        </section>

        {/* Categories */}
        <section className="container py-16 border-t">
          <h2 className="text-2xl font-bold mb-8 text-center">
            Browse by Category
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/jobs/${category.slug}`}
                className="flex flex-col items-center p-6 rounded-lg border hover:border-primary hover:shadow-md transition-all"
              >
                <span className="text-3xl mb-2">{category.icon}</span>
                <span className="font-medium">{category.name}</span>
                <span className="text-sm text-muted-foreground">View jobs</span>
              </Link>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="container py-16 border-t">
          <h2 className="text-2xl font-bold mb-8 text-center">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h3 className="font-semibold mb-2">We Scrape LinkedIn</h3>
              <p className="text-muted-foreground">
                Our system monitors LinkedIn for hiring posts and extracts job details automatically.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h3 className="font-semibold mb-2">You Browse & Filter</h3>
              <p className="text-muted-foreground">
                Search by category, level, location, or salary. See both extracted facts and original posts.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h3 className="font-semibold mb-2">Apply via Email</h3>
              <p className="text-muted-foreground">
                Send your application directly from our platform. We track opens and replies.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="container py-16">
          <div className="bg-primary text-primary-foreground rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Ready to find your next remote job?
            </h2>
            <p className="text-lg opacity-90 mb-8 max-w-xl mx-auto">
              Join thousands of professionals who found their dream remote position through Freelanly.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/jobs">Start Browsing Jobs</Link>
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
