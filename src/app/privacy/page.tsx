import { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for Freelanly - Learn how we collect, use, and protect your personal information.',
  alternates: {
    canonical: `${siteConfig.url}/privacy`,
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-12 max-w-4xl">
          <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

          <div className="prose prose-gray max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">1. Information We Collect</h2>

              <h3 className="text-lg font-medium mb-3 mt-4">1.1 Information You Provide</h3>
              <p className="mb-4">
                We collect information you provide directly to us, such as when you create an account,
                apply for jobs, or contact us. This may include:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name and email address</li>
                <li>Resume and professional information</li>
                <li>Job search preferences</li>
                <li>Communications with us</li>
              </ul>

              <h3 className="text-lg font-medium mb-3 mt-4">1.2 Publicly Available Job Postings</h3>
              <p className="mb-4">
                We aggregate job opportunities and freelance projects from publicly available sources,
                including social media platforms such as LinkedIn. When individuals or companies publicly
                post job opportunities or project requests, we may collect and display:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Name of the person or company posting the opportunity</li>
                <li>Professional headline or title</li>
                <li>Profile photo (if publicly available)</li>
                <li>Link to the original public post</li>
                <li>Link to the public profile</li>
                <li>The content of the job posting itself</li>
              </ul>
              <p className="mb-4">
                This information is collected from publicly accessible posts that individuals have chosen
                to share publicly. We do not collect private messages, private profile information, or
                any data that requires authentication to access.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">2. How We Use Your Information</h2>
              <p className="mb-4">We use the information we collect to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Provide, maintain, and improve our services</li>
                <li>Process job applications and connect you with employers</li>
                <li>Send you job alerts and relevant opportunities</li>
                <li>Respond to your comments and questions</li>
                <li>Send promotional communications (with your consent)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">3. Legal Basis for Processing</h2>
              <p className="mb-4">We process personal data under the following legal bases:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>
                  <strong>Consent:</strong> When you create an account or subscribe to job alerts,
                  you consent to our processing of your data for those purposes.
                </li>
                <li>
                  <strong>Contract:</strong> Processing necessary to provide our services to registered users.
                </li>
                <li>
                  <strong>Legitimate Interest:</strong> For publicly posted job opportunities, we rely on
                  legitimate interest. Job posters publicly share opportunities with the intent to reach
                  potential candidates. Our aggregation service helps achieve this goal by increasing
                  visibility of their posts to relevant job seekers. This benefits both parties: posters
                  reach more candidates, and job seekers discover more opportunities.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">4. Information Sharing</h2>
              <p className="mb-4">
                We do not sell your personal information. We may share your information with:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Employers when you apply for a job</li>
                <li>Service providers who assist in our operations</li>
                <li>Law enforcement when required by law</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">5. Data Security</h2>
              <p className="mb-4">
                We implement appropriate security measures to protect your personal information
                against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
              <p className="mb-4">We retain data for different periods depending on the type:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>
                  <strong>User account data:</strong> Retained until you delete your account or
                  request deletion.
                </li>
                <li>
                  <strong>Job postings from company career pages:</strong> Retained for up to 30 days
                  after the posting date, then automatically deleted.
                </li>
                <li>
                  <strong>Freelance opportunities from social media:</strong> Retained for up to 14 days
                  after the posting date, then automatically deleted. This shorter period reflects the
                  typically urgent nature of these opportunities.
                </li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">7. Your Rights</h2>
              <p className="mb-4">You have the right to:</p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>Access and update your personal information</li>
                <li>Request deletion of your data</li>
                <li>Opt-out of marketing communications</li>
                <li>Request a copy of your data</li>
              </ul>

              <h3 className="text-lg font-medium mb-3 mt-4">7.1 Removal of Publicly Posted Content</h3>
              <p className="mb-4">
                If you have posted a job opportunity or freelance project on social media and we have
                aggregated it on our platform, you have the right to request its removal. To do so:
              </p>
              <ul className="list-disc pl-6 mb-4 space-y-2">
                <li>
                  Email us at{' '}
                  <a href="mailto:removal@freelanly.com" className="text-primary hover:underline">
                    removal@freelanly.com
                  </a>{' '}
                  with the URL of the listing you want removed
                </li>
                <li>Include a link to your original post or profile to verify ownership</li>
                <li>We will process your request within 72 hours</li>
              </ul>
              <p className="mb-4">
                You can also click the &quot;Request Removal&quot; link on any opportunity page to submit
                a removal request directly.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">8. Cookies</h2>
              <p className="mb-4">
                We use cookies and similar technologies to provide and improve our services,
                analyze usage, and deliver relevant content.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4">9. Contact Us</h2>
              <p className="mb-4">
                If you have questions about this Privacy Policy, please contact us at{' '}
                <a href="mailto:privacy@freelanly.com" className="text-primary hover:underline">
                  privacy@freelanly.com
                </a>
              </p>
              <p className="mb-4">
                For removal requests regarding aggregated content, please email{' '}
                <a href="mailto:removal@freelanly.com" className="text-primary hover:underline">
                  removal@freelanly.com
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
            name: 'Privacy Policy',
            description: 'Privacy Policy for Freelanly',
            breadcrumb: {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
                { '@type': 'ListItem', position: 2, name: 'Privacy Policy', item: `${siteConfig.url}/privacy` },
              ],
            },
          }),
        }}
      />
    </div>
  );
}
