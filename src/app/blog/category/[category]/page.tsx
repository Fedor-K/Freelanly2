import { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { Badge } from '@/components/ui/badge';
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
    return { title: 'Category Not Found' };
  }

  const title = category.metaTitle || `${category.name} - Remote Work Articles | Freelanly Blog`;
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
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="container py-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {' / '}
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
            {' / '}
            <span className="text-foreground">{category.name}</span>
          </nav>

          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" />
            All Articles
          </Link>

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              {category.icon && <span className="text-4xl">{category.icon}</span>}
              <h1 className="text-4xl font-bold">{category.name}</h1>
            </div>
            {category.description && (
              <p className="text-xl text-muted-foreground max-w-2xl">
                {category.description}
              </p>
            )}
            <p className="text-muted-foreground mt-2">
              {total} {total === 1 ? 'article' : 'articles'}
            </p>
          </header>

          {/* Other Categories */}
          <div className="flex flex-wrap gap-2 mb-8">
            <Link href="/blog">
              <Badge variant="outline" className="cursor-pointer">
                All Posts
              </Badge>
            </Link>
            {allCategories.map((cat) => (
              <Link key={cat.slug} href={`/blog/category/${cat.slug}`}>
                <Badge
                  variant={cat.slug === categorySlug ? 'default' : 'outline'}
                  className="cursor-pointer"
                >
                  {cat.icon} {cat.name} ({cat._count.posts})
                </Badge>
              </Link>
            ))}
          </div>

          {/* Posts */}
          {posts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <BlogPostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No articles in this category yet. Check back soon!
              </p>
              <Link href="/blog" className="text-primary hover:underline mt-2 inline-block">
                Browse all articles
              </Link>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-8 flex justify-center gap-2">
              {currentPage > 1 && (
                <Link
                  href={`/blog/category/${categorySlug}?page=${currentPage - 1}`}
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
                  href={`/blog/category/${categorySlug}?page=${currentPage + 1}`}
                  className="px-4 py-2 border rounded hover:bg-muted"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </main>

      <Footer />

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
