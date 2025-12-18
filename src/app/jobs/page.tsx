import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { JobCard } from '@/components/jobs/JobCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { siteConfig, categories, levels, jobTypes, locationTypes } from '@/config/site';

export const metadata: Metadata = {
  title: 'Remote Jobs - Browse 1000+ Remote Work Positions | Freelanly',
  description: 'Find remote jobs from LinkedIn posts and top companies. Filter by category, level, location, and salary. Updated hourly with new remote opportunities.',
  keywords: [
    'remote jobs',
    'work from home jobs',
    'remote work',
    'remote developer jobs',
    'remote design jobs',
    'remote marketing jobs',
  ],
  openGraph: {
    title: 'Remote Jobs - Browse All Positions',
    description: 'Find remote jobs from LinkedIn posts and top companies. Filter by category, level, location, and salary.',
    url: `${siteConfig.url}/jobs`,
    siteName: siteConfig.name,
  },
  alternates: {
    canonical: `${siteConfig.url}/jobs`,
  },
};

// Mock data for now - will be replaced with DB query
const mockJobs = [
  {
    id: '1',
    slug: 'senior-react-developer-acme-corp',
    title: 'Senior React Developer',
    company: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      logo: null,
    },
    location: 'Remote',
    locationType: 'REMOTE',
    level: 'SENIOR',
    type: 'FULL_TIME',
    salaryMin: 120000,
    salaryMax: 160000,
    salaryCurrency: 'USD',
    salaryIsEstimate: true,
    skills: ['React', 'TypeScript', 'Node.js'],
    source: 'LINKEDIN',
    sourceType: 'UNSTRUCTURED',
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: '2',
    slug: 'product-designer-startup-xyz',
    title: 'Product Designer',
    company: {
      name: 'Startup XYZ',
      slug: 'startup-xyz',
      logo: null,
    },
    location: 'Remote (US)',
    locationType: 'REMOTE_US',
    level: 'MID',
    type: 'FULL_TIME',
    salaryMin: 90000,
    salaryMax: 130000,
    salaryCurrency: 'USD',
    salaryIsEstimate: false,
    skills: ['Figma', 'User Research', 'Prototyping'],
    source: 'GREENHOUSE',
    sourceType: 'STRUCTURED',
    postedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: '3',
    slug: 'devops-engineer-tech-inc',
    title: 'DevOps Engineer',
    company: {
      name: 'Tech Inc',
      slug: 'tech-inc',
      logo: null,
    },
    location: 'Remote (Europe)',
    locationType: 'REMOTE_EU',
    level: 'SENIOR',
    type: 'CONTRACT',
    salaryMin: 80000,
    salaryMax: 120000,
    salaryCurrency: 'EUR',
    salaryIsEstimate: true,
    skills: ['AWS', 'Kubernetes', 'Terraform', 'CI/CD'],
    source: 'LINKEDIN',
    sourceType: 'UNSTRUCTURED',
    postedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
];

export default function JobsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Remote Jobs</h1>
            <p className="text-muted-foreground">
              {mockJobs.length} jobs found
            </p>
          </div>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-20 space-y-6">
                {/* Search */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <Input placeholder="Job title, company..." />
                </div>

                {/* Categories */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <div className="space-y-1">
                    {categories.map((category) => (
                      <Link
                        key={category.slug}
                        href={`/jobs/${category.slug}`}
                        className="block px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                      >
                        {category.icon} {category.name}
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Level */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Level</label>
                  <div className="space-y-1">
                    {levels.map((level) => (
                      <label key={level.value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded" />
                        {level.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Job Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Job Type</label>
                  <div className="space-y-1">
                    {jobTypes.map((type) => (
                      <label key={type.value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded" />
                        {type.label}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Location</label>
                  <div className="space-y-1">
                    {locationTypes.map((loc) => (
                      <label key={loc.value} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" className="rounded" />
                        {loc.label}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* Job List */}
            <div className="flex-1">
              {/* Active Filters */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Filters:</span>
                <Badge variant="secondary">All Categories</Badge>
                <Badge variant="secondary">All Levels</Badge>
                <Button variant="ghost" size="sm" className="text-xs">
                  Clear all
                </Button>
              </div>

              {/* Jobs */}
              <div className="space-y-4">
                {mockJobs.map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-8 flex justify-center gap-2">
                <Button variant="outline" disabled>
                  Previous
                </Button>
                <Button variant="outline">
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />

      {/* ItemList Schema for Job Listings */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Remote Jobs',
            description: 'Browse all remote job opportunities',
            numberOfItems: mockJobs.length,
            itemListElement: mockJobs.map((job, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
              name: `${job.title} at ${job.company.name}`,
            })),
          }),
        }}
      />

      {/* BreadcrumbList Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Remote Jobs', item: `${siteConfig.url}/jobs` },
            ],
          }),
        }}
      />
    </div>
  );
}
