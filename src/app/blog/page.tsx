import { Metadata } from 'next';
import Link from 'next/link';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { MarketingNav, MarketingFooter, MarketingCTA } from '@/components/marketing/MarketingShell';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Blog - Remote Work Tips, Salary Guides & Career Advice',
  description: 'Guides for engineers landing remote roles — salaries, interviews, applications.',
  keywords: ['remote work blog', 'remote job tips', 'salary guides', 'career advice', 'work from home'],
  openGraph: {
    title: 'Freelanly Blog — Remote Tech Careers, Salaries & Applications',
    description: 'Guides for engineers landing remote roles — salaries, interviews, applications.',
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
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      <main className="pt-28 pb-4">
        <div className="max-w-[1240px] mx-auto px-8">
          {/* Header */}
          <header className="mb-10">
            <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Blog</span>
            <h1 className="text-[clamp(32px,4vw,48px)] font-semibold tracking-tighter mt-3 mb-4">Freelanly Blog</h1>
            <p className="text-lg text-[#A1A1AA] max-w-2xl">
              Guides for engineers landing remote roles — salaries, interviews, applications.
            </p>
          </header>

          {/* Category Filter — empty categories hidden */}
          <div className="flex flex-wrap gap-2 mb-10">
            <Link href="/blog"
              className="px-3.5 py-1.5 rounded-full text-[13px] transition-colors"
              style={!category ? { background: '#C7F94A', color: '#0A0B0F', fontWeight: 600 } : { border: '1px solid rgba(255,255,255,0.14)', color: '#A1A1AA' }}>
              All posts
            </Link>
            {categories.filter((cat) => cat._count.posts > 0).map((cat) => (
              <Link key={cat.slug} href={`/blog/category/${cat.slug}`}
                className="px-3.5 py-1.5 rounded-full text-[13px] transition-colors hover:bg-white/5"
                style={category === cat.slug ? { background: '#C7F94A', color: '#0A0B0F', fontWeight: 600 } : { border: '1px solid rgba(255,255,255,0.14)', color: '#A1A1AA' }}>
                {cat.name} ({cat._count.posts})
              </Link>
            ))}
          </div>

          {/* Featured Posts (only on page 1, no category filter) */}
          {currentPage === 1 && !category && featuredPosts.length > 0 && (
            <section className="mb-14">
              <h2 className="font-mono text-xs tracking-widest uppercase text-[#6B7280] mb-5">Featured</h2>
              <div className="grid md:grid-cols-3 gap-5">
                {featuredPosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} featured />
                ))}
              </div>
            </section>
          )}

          {/* All Posts */}
          <section>
            <h2 className="font-mono text-xs tracking-widest uppercase text-[#6B7280] mb-5">
              {category ? `${categories.find(c => c.slug === category)?.name || 'Category'}` : 'Latest'} · {total} {total === 1 ? 'article' : 'articles'}
            </h2>

            {posts.length > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
                {posts.map((post) => (
                  <BlogPostCard key={post.id} post={post} />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-[#A1A1AA]">No articles found. Check back soon!</p>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex justify-center items-center gap-2">
                {currentPage > 1 && (
                  <Link href={`/blog?page=${currentPage - 1}${category ? `&category=${category}` : ''}`}
                    className="px-4 py-2 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                    ← Previous
                  </Link>
                )}
                <span className="px-4 font-mono text-[12px] text-[#6B7280]">Page {currentPage} of {totalPages}</span>
                {currentPage < totalPages && (
                  <Link href={`/blog?page=${currentPage + 1}${category ? `&category=${category}` : ''}`}
                    className="px-4 py-2 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                    Next →
                  </Link>
                )}
              </nav>
            )}
          </section>
        </div>
      </main>

      <MarketingCTA />
      <MarketingFooter />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'Freelanly Blog',
            description: 'Guides for engineers landing remote roles — salaries, interviews, applications.',
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
