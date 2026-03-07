import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { OpportunityCard } from '@/components/opportunities/OpportunityCard';
import { Button } from '@/components/ui/button';
import { siteConfig, categories } from '@/config/site';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getMaxJobAgeDate } from '@/lib/utils';

export const revalidate = 60;

type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

interface Props {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateStaticParams() {
  return categories.map((cat) => ({ category: cat.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();

  return {
    title: `Freelance ${category.name} Projects`,
    description: `Browse freelance ${category.name.toLowerCase()} projects from LinkedIn. Direct client opportunities updated daily.`,
    openGraph: {
      title: `Freelance ${category.name} Projects`,
      description: `Browse freelance ${category.name.toLowerCase()} projects from LinkedIn.`,
      url: `${siteConfig.url}/freelance/${category.slug}`,
      siteName: siteConfig.name,
    },
    alternates: {
      canonical: `${siteConfig.url}/freelance/${category.slug}`,
    },
  };
}

export default async function FreelanceCategoryPage({ params, searchParams }: Props) {
  const { category: categorySlug } = await params;
  const { page = '1' } = await searchParams;

  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();

  const session = await auth();
  let userPlan: UserPlan = 'FREE';
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    if (user?.plan) userPlan = user.plan as UserPlan;
  }
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const currentPage = Math.max(1, parseInt(page, 10) || 1);
  const perPage = 20;
  const maxAgeDate = getMaxJobAgeDate();

  let opportunities: any[] = [];
  let totalCount = 0;

  try {
    const where = {
      isActive: true,
      postedAt: { gte: maxAgeDate },
      category: { slug: categorySlug },
    };

    [opportunities, totalCount] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: {
          company: {
            select: { name: true, slug: true, logo: true, website: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * perPage,
        take: perPage,
      }),
      prisma.opportunity.count({ where }),
    ]);
  } catch (error) {
    console.error('Failed to fetch opportunities:', error);
  }

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-6 sm:py-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
            <ol className="flex items-center space-x-2">
              <li><Link href="/" className="hover:text-foreground">Home</Link></li>
              <li>/</li>
              <li><Link href="/freelance" className="hover:text-foreground">Freelance</Link></li>
              <li>/</li>
              <li className="text-foreground font-medium">{category.name}</li>
            </ol>
          </nav>

          <div className="mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-1">
              Freelance {category.name} Projects
            </h1>
            <p className="text-muted-foreground text-sm">
              {totalCount > 0
                ? `${totalCount} ${category.name.toLowerCase()} projects available`
                : `Browse ${category.name.toLowerCase()} freelance opportunities`}
            </p>
          </div>

          {opportunities.length > 0 ? (
            <div className="space-y-4">
              {opportunities.map((opp) => (
                <OpportunityCard key={opp.id} opportunity={opp} isPro={isPro} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <p className="text-muted-foreground mb-4">
                No {category.name.toLowerCase()} freelance projects found at the moment.
              </p>
              <Link href="/freelance">
                <Button variant="outline">Browse all categories</Button>
              </Link>
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mt-8 flex justify-center gap-2">
              {currentPage > 1 ? (
                <Link href={`/freelance/${category.slug}?page=${currentPage - 1}`}>
                  <Button variant="outline">Previous</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Previous</Button>
              )}
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Link href={`/freelance/${category.slug}?page=${currentPage + 1}`}>
                  <Button variant="outline">Next</Button>
                </Link>
              ) : (
                <Button variant="outline" disabled>Next</Button>
              )}
            </nav>
          )}

          {/* Related categories */}
          <div className="mt-12 border-t pt-8">
            <h2 className="text-lg font-semibold mb-3">Other Categories</h2>
            <div className="flex flex-wrap gap-2">
              {categories
                .filter((c) => c.slug !== categorySlug)
                .slice(0, 8)
                .map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/freelance/${cat.slug}`}
                    className="px-3 py-1.5 text-sm border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {cat.icon} {cat.name}
                  </Link>
                ))}
            </div>
          </div>
        </div>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Freelance', item: `${siteConfig.url}/freelance` },
              { '@type': 'ListItem', position: 3, name: `${category.name}`, item: `${siteConfig.url}/freelance/${category.slug}` },
            ],
          }),
        }}
      />
    </div>
  );
}
