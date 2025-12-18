import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Terms of Service | Freelanly',
  description: 'Terms of Service for Freelanly - Read our terms and conditions for using our job board platform.',
  alternates: {
    canonical: `${siteConfig.url}/terms`,
  },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-12 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Terms of Service</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="mb-4">
                By accessing and using Freelanly (&quot;the Service&quot;), you accept and agree to be bound
                by the terms and provisions of this agreement. If you do not agree to these terms,
                please do not use our Service.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
              <p className="mb-4">
                Freelanly is a job board platform that aggregates remote job opportunities from
                various sources including LinkedIn posts and company career pages. We facilitate
                connections between job seekers and employers but are not a party to any employment
                agreements.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. User Responsibilities</h2>
              <p className="mb-4">As a user of our Service, you agree to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide accurate and truthful information</li>
                <li>Maintain the confidentiality of your account</li>
                <li>Not use the Service for any unlawful purpose</li>
                <li>Not attempt to gain unauthorized access to any part of the Service</li>
                <li>Not scrape or collect data from the Service without permission</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Job Listings</h2>
              <p className="mb-4">
                Job listings on Freelanly are sourced from various platforms and employers.
                While we strive to provide accurate information, we do not guarantee the accuracy,
                completeness, or reliability of any job listing. Users should verify all information
                directly with the employer before applying.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Employer Terms</h2>
              <p className="mb-4">Employers using our Service agree to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Post only legitimate job opportunities</li>
                <li>Provide accurate job descriptions and requirements</li>
                <li>Comply with all applicable employment laws</li>
                <li>Not discriminate based on protected characteristics</li>
                <li>Handle applicant data in accordance with privacy laws</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Intellectual Property</h2>
              <p className="mb-4">
                All content on Freelanly, including text, graphics, logos, and software,
                is the property of Freelanly or its content suppliers and is protected by
                intellectual property laws.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p className="mb-4">
                Freelanly shall not be liable for any indirect, incidental, special, consequential,
                or punitive damages resulting from your use of the Service. We do not guarantee
                employment outcomes or the accuracy of job listings.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Termination</h2>
              <p className="mb-4">
                We reserve the right to terminate or suspend access to our Service immediately,
                without prior notice, for any reason whatsoever, including without limitation
                if you breach these Terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Changes to Terms</h2>
              <p className="mb-4">
                We reserve the right to modify these terms at any time. We will notify users
                of any material changes by posting the new Terms on this page. Continued use
                of the Service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">10. Contact Us</h2>
              <p className="mb-4">
                If you have questions about these Terms, please contact us at{' '}
                <a href="mailto:legal@freelanly.com" className="text-primary hover:underline">
                  legal@freelanly.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebPage',
            name: 'Terms of Service',
            description: 'Terms of Service for Freelanly',
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
                { '@type': 'ListItem', position: 2, name: 'Terms of Service', item: `${siteConfig.url}/terms` },
              ],
            },
          }),
        }}
      />
    </div>
  );
}
