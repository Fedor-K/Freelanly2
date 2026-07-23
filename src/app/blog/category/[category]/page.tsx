import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

interface CategoryPageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function getCategory(slug: string) {
  return prisma.blogCategory.findUnique({
    where: { slug },
  });
}

async function getCategoryPosts(categorySlug: string, page: number) {
  const perPage = 12;

  const [posts, total] = await Promise.all([
    prisma.blogPost.findMany({
      where: { categorySlug, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
      include: { category: true },
    }),
    prisma.blogPost.count({
      where: { categorySlug, status: 'PUBLISHED' },
    }),
  ]);

  return {
    posts,
    total,
    totalPages: Math.ceil(total / perPage),
  };
}

async function getAllCategories() {
  return prisma.blogCategory.findMany({
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { posts: { where: { status: 'PUBLISHED' } } },
      },
    },
  });
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: categorySlug } = await params;
  const category = await getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  const title = category.metaTitle || `${category.name} - Remote Work Articles`;
  const description = category.metaDescription || category.description || `Browse all ${category.name.toLowerCase()} articles on the Freelanly Blog.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}/blog/category/${category.slug}`,
      type: 'website',
    },
    alternates: {
      canonical: `${siteConfig.url}/blog/category/${category.slug}`,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { category: categorySlug } = await params;
  const { page = '1' } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;

  const category = await getCategory(categorySlug);

  if (!category) {
    notFound();
  }

  const [{ posts, total, totalPages }, allCategories] = await Promise.all([
    getCategoryPosts(categorySlug, currentPage),
    getAllCategories(),
  ]);

  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      <main className="pt-28 pb-4">
        <div className="max-w-[1240px] mx-auto px-8">
          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center text-sm text-[#A1A1AA] hover:text-white mb-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            All articles
          </Link>

          {/* Header */}
          <header className="mb-10">
            <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— {category.name}</span>
            <h1 className="text-[clamp(30px,3.6vw,44px)] font-semibold tracking-tighter mt-3 mb-3">{category.name}</h1>
            {category.description && (
              <p className="text-lg text-[#A1A1AA] max-w-2xl">{category.description}</p>
            )}
            <p className="font-mono text-[12px] text-[#6B7280] mt-3">{total} {total === 1 ? 'article' : 'articles'}</p>
          </header>

          {/* Other Categories — empty ones hidden */}
          <div className="flex flex-wrap gap-2 mb-10">
            <Link href="/blog"
              className="px-3.5 py-1.5 rounded-full text-[13px] hover:bg-white/5"
              style={{ border: '1px solid rgba(255,255,255,0.14)', color: '#A1A1AA' }}>
              All posts
            </Link>
            {allCategories.filter((cat) => cat._count.posts > 0).map((cat) => (
              <Link key={cat.slug} href={`/blog/category/${cat.slug}`}
                className="px-3.5 py-1.5 rounded-full text-[13px] hover:bg-white/5"
                style={cat.slug === categorySlug ? { background: '#C7F94A', color: '#0A0B0F', fontWeight: 600 } : { border: '1px solid rgba(255,255,255,0.14)', color: '#A1A1AA' }}>
                {cat.name} ({cat._count.posts})
              </Link>
            ))}
          </div>

          {/* Posts */}
          {posts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-[#A1A1AA]">No articles in this category yet. Check back soon!</p>
              <Link href="/blog" className="text-[#C7F94A] hover:underline mt-2 inline-block">Browse all articles</Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-10 flex justify-center items-center gap-2">
              {currentPage > 1 && (
                <Link href={`/blog/category/${categorySlug}?page=${currentPage - 1}`}
                  className="px-4 py-2 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                  ← Previous
                </Link>
              )}
              <span className="px-4 font-mono text-[12px] text-[#6B7280]">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages && (
                <Link href={`/blog/category/${categorySlug}?page=${currentPage + 1}`}
                  className="px-4 py-2 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                  Next →
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>

      <MarketingFooter />

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: category.name,
            description: category.description,
            url: `${siteConfig.url}/blog/category/${category.slug}`,
            isPartOf: {
              '@type': 'Blog',
              name: 'Freelanly Blog',
              url: `${siteConfig.url}/blog`,
            },
          }),
        }}
      />
    </div>
  );
}
