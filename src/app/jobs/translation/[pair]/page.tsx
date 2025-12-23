import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { siteConfig, languages, languagePairs } from '@/config/site';
import { JobCard } from '@/components/jobs/JobCard';
import { Pagination } from '@/components/ui/Pagination';

interface PageProps {
  params: Promise<{ pair: string }>;
  searchParams: Promise<{ page?: string }>;
}

// Find language pair by slug
function getLanguagePair(slug: string) {
  return languagePairs.find((p) => p.slug === slug);
}

// Get language name by slug
function getLanguageName(slug: string) {
  const lang = languages.find((l) => l.slug === slug);
  return lang?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
}

// Get language code by slug
function getLanguageCode(slug: string) {
  const lang = languages.find((l) => l.slug === slug);
  return lang?.code || slug.toUpperCase().slice(0, 2);
}

// Get related language pairs (same source or target language)
function getRelatedPairs(currentPair: typeof languagePairs[number]) {
  return languagePairs
    .filter(
      (p) =>
        p.slug !== currentPair.slug &&
        (p.source === currentPair.source || p.target === currentPair.target)
    )
    .slice(0, 8);
}

// Generate static params for all language pairs
export async function generateStaticParams() {
  return languagePairs.map((pair) => ({
    pair: pair.slug,
  }));
}

// Generate metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { pair: pairSlug } = await params;
  const pair = getLanguagePair(pairSlug);

  if (!pair) {
    return {
      title: 'Language Pair Not Found',
    };
  }

  const sourceName = getLanguageName(pair.source);
  const targetName = getLanguageName(pair.target);
  const title = `${sourceName} to ${targetName} Translation Jobs | Remote ${sourceName}-${targetName} Translator`;
  const description = `Find remote ${sourceName} to ${targetName} translation jobs. Apply to ${sourceName}-${targetName} translator positions at top companies. Updated daily.`;

  return {
    title,
    description,
    keywords: [
      `${sourceName} to ${targetName} translation jobs`,
      `${sourceName} ${targetName} translator`,
      `remote translation jobs`,
      `${sourceName} translator`,
      `${targetName} translator`,
      `freelance translator`,
      `translation jobs remote`,
    ],
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/jobs/translation/${pairSlug}`,
      siteName: siteConfig.name,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    alternates: {
      canonical: `${siteConfig.url}/jobs/translation/${pairSlug}`,
    },
  };
}

export default async function TranslationPairPage({ params, searchParams }: PageProps) {
  const { pair: pairSlug } = await params;
  const { page: pageParam } = await searchParams;

  const pair = getLanguagePair(pairSlug);

  if (!pair) {
    notFound();
  }

  const sourceName = getLanguageName(pair.source);
  const targetName = getLanguageName(pair.target);
  const sourceCode = getLanguageCode(pair.source);
  const targetCode = getLanguageCode(pair.target);

  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const perPage = 20;
  const skip = (page - 1) * perPage;

  // Find translation category
  const translationCategory = await prisma.category.findFirst({
    where: { slug: 'translation' },
  });

  // Build where clause - filter by translation category and language arrays
  const where: Record<string, unknown> = {
    isActive: true,
    categoryId: translationCategory?.id,
  };

  // Filter by source and target languages in the arrays
  // Jobs should have the source language in sourceLanguages AND target language in targetLanguages
  where.OR = [
    {
      AND: [
        { sourceLanguages: { has: sourceCode } },
        { targetLanguages: { has: targetCode } },
      ],
    },
    // Also match jobs that have both languages in either array (for bidirectional translators)
    {
      AND: [
        { sourceLanguages: { hasSome: [sourceCode, targetCode] } },
        { targetLanguages: { hasSome: [sourceCode, targetCode] } },
      ],
    },
    // Fallback: search in title/description for language names
    {
      OR: [
        {
          title: {
            contains: sourceName,
            mode: 'insensitive' as const,
          },
        },
        {
          description: {
            contains: `${sourceName} to ${targetName}`,
            mode: 'insensitive' as const,
          },
        },
        {
          description: {
            contains: `${sourceName}-${targetName}`,
            mode: 'insensitive' as const,
          },
        },
      ],
    },
  ];

  // Get jobs and count
  const [jobs, totalCount] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
            website: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      skip,
      take: perPage,
    }),
    prisma.job.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / perPage);
  const relatedPairs = getRelatedPairs(pair);

  // Schema.org structured data
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteConfig.url,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Jobs',
        item: `${siteConfig.url}/jobs`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Translation',
        item: `${siteConfig.url}/jobs/translation`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: `${sourceName} to ${targetName}`,
        item: `${siteConfig.url}/jobs/translation/${pairSlug}`,
      },
    ],
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${sourceName} to ${targetName} Translation Jobs`,
    description: `Remote ${sourceName} to ${targetName} translation positions`,
    numberOfItems: totalCount,
    itemListElement: jobs.slice(0, 10).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`,
      name: job.title,
    })),
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `How many ${sourceName} to ${targetName} translation jobs are available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `There are currently ${totalCount} remote ${sourceName} to ${targetName} translation jobs available on ${siteConfig.name}. New positions are added daily.`,
        },
      },
      {
        '@type': 'Question',
        name: `What qualifications do I need for ${sourceName}-${targetName} translation?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Most ${sourceName}-${targetName} translation jobs require native or near-native fluency in both languages, relevant translation experience, and often certification from recognized translation organizations. Specialized knowledge in specific fields (legal, medical, technical) can increase opportunities.`,
        },
      },
      {
        '@type': 'Question',
        name: `Can I work remotely as a ${sourceName}-${targetName} translator?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes! Translation is one of the most remote-friendly professions. All jobs listed on this page are remote positions, allowing you to work from anywhere while translating between ${sourceName} and ${targetName}.`,
        },
      },
      {
        '@type': 'Question',
        name: `What is the typical rate for ${sourceName} to ${targetName} translation?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Rates vary based on experience, specialization, and project complexity. ${sourceName}-${targetName} translators typically earn between $0.08-$0.25 per word for general content, with specialized translations (legal, medical, technical) commanding higher rates.`,
        },
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="mb-6 text-sm text-gray-500">
          <ol className="flex items-center space-x-2">
            <li>
              <Link href="/" className="hover:text-gray-700">
                Home
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/jobs" className="hover:text-gray-700">
                Jobs
              </Link>
            </li>
            <li>/</li>
            <li>
              <Link href="/jobs/translation" className="hover:text-gray-700">
                Translation
              </Link>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-medium">
              {sourceName} to {targetName}
            </li>
          </ol>
        </nav>

        {/* Hero Section */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            {sourceName} to {targetName} Translation Jobs
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl">
            Find remote {sourceName}-{targetName} translator positions. Browse {totalCount}{' '}
            translation jobs and apply directly to top companies hiring{' '}
            {sourceName.toLowerCase()} translators.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="bg-blue-50 rounded-lg p-4 mb-8 flex flex-wrap gap-6">
          <div>
            <span className="text-2xl font-bold text-blue-600">{totalCount}</span>
            <span className="text-gray-600 ml-2">Open Positions</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-blue-600">🌐</span>
            <span className="text-gray-600 ml-2">100% Remote</span>
          </div>
          <div>
            <span className="text-2xl font-bold text-blue-600">📅</span>
            <span className="text-gray-600 ml-2">Updated Daily</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Job Listings */}
            {jobs.length > 0 ? (
              <div className="space-y-4">
                {jobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={{
                      id: job.id,
                      title: job.title,
                      slug: job.slug,
                      company: job.company,
                      location: job.location,
                      locationType: job.locationType,
                      salary: job.salary,
                      salaryCurrency: job.salaryCurrency,
                      salaryPeriod: job.salaryPeriod,
                      level: job.level,
                      type: job.type,
                      postedAt: job.postedAt,
                      category: job.category,
                      sourceLanguages: job.sourceLanguages,
                      targetLanguages: job.targetLanguages,
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-lg mb-4">
                  No {sourceName} to {targetName} translation jobs found at the moment.
                </p>
                <p className="text-gray-500">
                  Check back soon or{' '}
                  <Link href="/dashboard/alerts" className="text-blue-600 hover:underline">
                    set up a job alert
                  </Link>{' '}
                  to get notified when new positions are posted.
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  basePath={`/jobs/translation/${pairSlug}`}
                />
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Related Language Pairs */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Related Language Pairs</h2>
              <div className="space-y-2">
                {relatedPairs.map((rp) => (
                  <Link
                    key={rp.slug}
                    href={`/jobs/translation/${rp.slug}`}
                    className="block text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {getLanguageName(rp.source)} → {getLanguageName(rp.target)}
                  </Link>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white border rounded-lg p-4">
              <h2 className="font-semibold text-gray-900 mb-4">Browse by Language</h2>
              <div className="flex flex-wrap gap-2">
                {languages.slice(0, 10).map((lang) => (
                  <Link
                    key={lang.slug}
                    href={`/jobs/translation/english-${lang.slug}`}
                    className="text-sm px-3 py-1 bg-gray-100 rounded-full hover:bg-gray-200 text-gray-700"
                  >
                    {lang.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Job Alert CTA */}
            <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg p-4 text-white">
              <h3 className="font-semibold mb-2">Get Job Alerts</h3>
              <p className="text-sm text-blue-100 mb-3">
                Be the first to know about new {sourceName}-{targetName} translation jobs.
              </p>
              <Link
                href="/dashboard/alerts"
                className="block w-full text-center bg-white text-blue-600 py-2 px-4 rounded-lg font-medium hover:bg-blue-50 transition-colors"
              >
                Create Alert
              </Link>
            </div>
          </div>
        </div>

        {/* SEO Content Section */}
        <div className="mt-12 prose prose-gray max-w-none">
          <h2>{sourceName} to {targetName} Translator Jobs: Your Complete Guide</h2>
          <p>
            Looking for remote {sourceName} to {targetName} translation work? {siteConfig.name} lists
            hundreds of translation positions from companies around the world. Whether you&apos;re a
            freelance translator or looking for a full-time position, we have opportunities for
            every experience level.
          </p>

          <h3>Why Choose {sourceName}-{targetName} Translation?</h3>
          <p>
            {sourceName} to {targetName} translation is one of the most in-demand language pairs in
            the global market. With businesses expanding internationally, the need for qualified
            translators who can bridge these two languages has never been higher.
          </p>

          <h3>Types of {sourceName}-{targetName} Translation Jobs</h3>
          <ul>
            <li>
              <strong>Document Translation</strong> - Legal, medical, technical, and business
              documents
            </li>
            <li>
              <strong>Localization</strong> - Adapting software, websites, and apps for{' '}
              {targetName}-speaking markets
            </li>
            <li>
              <strong>Interpretation</strong> - Real-time translation for meetings and conferences
            </li>
            <li>
              <strong>Subtitling</strong> - Creating subtitles for video content
            </li>
            <li>
              <strong>Transcreation</strong> - Creative adaptation of marketing content
            </li>
          </ul>

          <h3>Skills Needed for {sourceName}-{targetName} Translation</h3>
          <p>
            To succeed as a {sourceName}-{targetName} translator, you&apos;ll need native or
            near-native proficiency in both languages, strong writing skills, attention to detail,
            and often specialized knowledge in your chosen field. CAT tools (Computer-Assisted
            Translation) experience is often required.
          </p>
        </div>

        {/* FAQ Section */}
        <div className="mt-12 bg-gray-50 rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                How many {sourceName} to {targetName} translation jobs are available?
              </h3>
              <p className="text-gray-600">
                There are currently {totalCount} remote {sourceName} to {targetName} translation
                jobs available on {siteConfig.name}. New positions are added daily.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What qualifications do I need for {sourceName}-{targetName} translation?
              </h3>
              <p className="text-gray-600">
                Most {sourceName}-{targetName} translation jobs require native or near-native
                fluency in both languages, relevant translation experience, and often certification
                from recognized translation organizations. Specialized knowledge in specific fields
                (legal, medical, technical) can increase opportunities.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                Can I work remotely as a {sourceName}-{targetName} translator?
              </h3>
              <p className="text-gray-600">
                Yes! Translation is one of the most remote-friendly professions. All jobs listed on
                this page are remote positions, allowing you to work from anywhere while translating
                between {sourceName} and {targetName}.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">
                What is the typical rate for {sourceName} to {targetName} translation?
              </h3>
              <p className="text-gray-600">
                Rates vary based on experience, specialization, and project complexity.{' '}
                {sourceName}-{targetName} translators typically earn between $0.08-$0.25 per word
                for general content, with specialized translations (legal, medical, technical)
                commanding higher rates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
