import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { Badge } from '@/components/ui/badge';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Blog - Remote Work Tips, Salary Guides & Career Advice',
  description: 'Expert advice on finding remote jobs, negotiating salaries, and building a successful remote career. Updated weekly with the latest insights.',
  keywords: ['remote work blog', 'remote job tips', 'salary guides', 'career advice', 'work from home'],
  openGraph: {
    title: 'Freelanly Blog - Remote Work Tips & Career Advice',
    description: 'Expert advice on finding remote jobs, negotiating salaries, and building a successful remote career.',
    url: `${siteConfig.url}/blog`,
    type: 'website',
  },
  alternates: {
    canonical: `${siteConfig.url}/blog`,
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; category?: string }>;
}

async function getBlogPosts(page: number, category?: string) {
  const perPage = 12;

  const where = {
    status: 'PUBLISHED' as const,
    ...(category && { categorySlug: category }),
  };

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        category: true,
      },
    }),
    prisma.blogPost.count({ where }),
  ]);

  return {
    posts,
    total,
    totalPages: Math.ceil(total / perPage),
    currentPage: page,
  };
}

async function getCategories() {
  return prisma.blogCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { posts: { where: { status: 'PUBLISHED' } } },
      },
    },
  });
}

async function getFeaturedPosts() {
  return prisma.blogPost.findMany({
    where: {
      status: 'PUBLISHED',
      featuredAt: { not: null },
    },
    orderBy: { featuredAt: 'desc' },
    take: 3,
    include: { category: true },
  });
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const { page = '1', category } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;

  const [{ posts, total, totalPages }, categories, featuredPosts] = await Promise.all([
    getBlogPosts(currentPage, category),
    getCategories(),
    getFeaturedPosts(),
  ]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Header */}
          <header className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Freelanly Blog</h1>
            <p className="text-xl text-muted-foreground max-w-2xl">
              Expert advice on finding remote jobs, negotiating salaries, and building a successful remote career.
            </p>
          </header>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href="/blog">
              <Badge
                variant={!category ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                All Posts
              </Badge>
            </Link>
            {categories.map((cat) => (
              <Link key={cat.slug} href={`/blog?category=${cat.slug}`}>
                <Badge
                  variant={category === cat.slug ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {cat.icon} {cat.name} ({cat._count.posts})
                </Badge>
              </Link>
            ))}
          </div>

          {/* Featured Posts (only on page 1, no category filter) */}
          {currentPage === 1 && !category && featuredPosts.length > 0 && (
            <section className="mb-12">
              <h2 className="text-2xl font-bold mb-4">Featured Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {featuredPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} featured />
                ))}
              </div>
            </section>
          )}

          {/* All Posts */}
          <section>
            <h2 className="text-2xl font-bold mb-4">
              {category ? `${categories.find(c => c.slug === category)?.name || 'Category'} Articles` : 'Latest Articles'}
              <span className="text-muted-foreground font-normal text-lg ml-2">
                ({total} {total === 1 ? 'article' : 'articles'})
              </span>
            </h2>

            {posts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map((post) => (
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No articles found. Check back soon!
                </p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-8 flex justify-center gap-2">
                {currentPage > 1 && (
                  <Link
                    href={`/blog?page=${currentPage - 1}${category ? `&category=${category}` : ''}`}
                    className="px-4 py-2 border rounded hover:bg-muted"
                  >
                    Previous
                  </Link>
                )}
                <span className="flex items-center px-4 text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link
                    href={`/blog?page=${currentPage + 1}${category ? `&category=${category}` : ''}`}
                    className="px-4 py-2 border rounded hover:bg-muted"
                  >
                    Next
                  </Link>
                )}
              </nav>
            )}
          </section>

          {/* Newsletter CTA */}
          <section className="mt-16 bg-muted rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Stay Updated</h2>
            <p className="text-muted-foreground mb-4">
              Get the latest remote work tips and job opportunities delivered to your inbox.
            </p>
            <Link
              href="/dashboard/alerts"
              className="inline-flex items-center px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90"
            >
              Set Up Job Alerts
            </Link>
          </section>
        </div>
      </main>

      <Footer />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Freelanly Blog',
            description: 'Expert advice on finding remote jobs, negotiating salaries, and building a successful remote career.',
            url: `${siteConfig.url}/blog`,
            publisher: {
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
            },
          }),
        }}
      />
    </div>
  );
}
