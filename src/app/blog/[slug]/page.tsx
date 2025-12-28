import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Clock, Calendar, Share2, ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { formatDistanceToNow } from '@/lib/utils';
import { marked } from 'marked';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

async function getBlogPost(slug: string) {
  const post = await prisma.blogPost.findUnique({
    where: { slug, status: 'PUBLISHED' },
    include: { category: true },
  });

  if (post) {
    // Increment view count
    await prisma.blogPost.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } },
    });
  }

  return post;
}

async function getRelatedPosts(post: { categorySlug: string; slug: string; relatedPosts: string[] }) {
  // First try to get manually specified related posts
  if (post.relatedPosts.length > 0) {
    const related = await prisma.blogPost.findMany({
      where: {
        slug: { in: post.relatedPosts },
        status: 'PUBLISHED',
      },
      include: { category: true },
      take: 3,
    });
    if (related.length > 0) return related;
  }

  // Fallback to same category
  return prisma.blogPost.findMany({
    where: {
      categorySlug: post.categorySlug,
      slug: { not: post.slug },
      status: 'PUBLISHED',
    },
    include: { category: true },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug },
    include: { category: true },
  });

  if (!post) {
    return {
      title: 'Article Not Found',
      robots: { index: false },
    };
  }

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || `Read ${post.title} on the Freelanly Blog.`;
  const url = `${siteConfig.url}/blog/${post.slug}`;
  const ogImage = post.ogImage || `${siteConfig.url}/api/og/blog?title=${encodeURIComponent(post.title)}&category=${encodeURIComponent(post.category.name)}`;

  return {
    title: title,
    description,
    keywords: post.keywords,
    authors: [{ name: post.authorName }],
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [post.authorName],
      section: post.category.name,
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: post.canonicalUrl || url,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await getBlogPost(slug);

  if (!post) {
    notFound();
  }

  const relatedPosts = await getRelatedPosts(post);
  const tocItems = (post.tableOfContents as { level: number; text: string; id: string }[]) || [];
  const faqItems = (post.faqItems as { question: string; answer: string }[]) || [];
  const postUrl = `${siteConfig.url}/blog/${post.slug}`;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <article className="container py-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">Home</Link>
            {' / '}
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
            {' / '}
            <Link href={`/blog?category=${post.categorySlug}`} className="hover:text-foreground">
              {post.category.name}
            </Link>
            {' / '}
            <span className="text-foreground">{post.title}</span>
          </nav>

          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Blog
          </Link>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Header */}
              <header className="mb-8">
                <Badge className="mb-4">
                  {post.category.icon} {post.category.name}
                </Badge>

                <h1 className="text-4xl font-bold mb-4">{post.title}</h1>

                {post.excerpt && (
                  <p className="text-xl text-muted-foreground mb-4">{post.excerpt}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {post.authorImage && (
                      <Image
                        src={post.authorImage}
                        alt={post.authorName}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                    <span>By {post.authorName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{post.readingTime} min read</span>
                  </div>
                  {post.publishedAt && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{post.publishedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                    </div>
                  )}
                </div>
              </header>

              {/* Featured Image */}
              {post.ogImage && (
                <div className="aspect-video relative rounded-lg overflow-hidden mb-8">
                  <Image
                    src={post.ogImage}
                    alt={post.ogImageAlt || post.title}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              )}

              {/* Mobile ToC */}
              {tocItems.length > 0 && (
                <div className="lg:hidden mb-8 p-4 bg-muted rounded-lg">
                  <TableOfContents items={tocItems} />
                </div>
              )}

              {/* Article Content */}
              <div
                className="prose prose-lg max-w-none prose-headings:scroll-mt-24"
                dangerouslySetInnerHTML={{ __html: marked.parse(post.content) as string }}
              />

              {/* Share */}
              <Separator className="my-8" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span className="font-medium">Share this article</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Twitter
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn
                    </a>
                  </Button>
                </div>
              </div>

              {/* Author Bio */}
              {post.authorBio && (
                <>
                  <Separator className="my-8" />
                  <div className="flex items-start gap-4 p-6 bg-muted rounded-lg">
                    {post.authorImage && (
                      <Image
                        src={post.authorImage}
                        alt={post.authorName}
                        width={64}
                        height={64}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <p className="font-semibold">{post.authorName}</p>
                      <p className="text-sm text-muted-foreground">{post.authorBio}</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 space-y-6">
                {/* Table of Contents */}
                {tocItems.length > 0 && (
                  <div className="p-4 border rounded-lg">
                    <TableOfContents items={tocItems} />
                  </div>
                )}

                {/* CTA */}
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <h4 className="font-semibold mb-2">Find Your Remote Job</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Browse thousands of remote positions updated daily.
                  </p>
                  <Button className="w-full" asChild>
                    <Link href="/jobs">Browse Jobs</Link>
                  </Button>
                </div>
              </div>
            </aside>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16">
              <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <BlogPostCard key={relatedPost.id} post={relatedPost} />
                ))}
              </div>
            </section>
          )}

          {/* Newsletter CTA */}
          <section className="mt-16 bg-muted rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Get More Tips Like This</h2>
            <p className="text-muted-foreground mb-4">
              Set up job alerts and never miss the perfect opportunity.
            </p>
            <Button asChild>
              <Link href="/dashboard/alerts">Set Up Job Alerts</Link>
            </Button>
          </section>
        </article>
      </main>

      <Footer />

      {/* Structured Data - Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.excerpt || post.metaDescription,
            image: post.ogImage || `${siteConfig.url}/api/og/blog?title=${encodeURIComponent(post.title)}`,
            datePublished: post.publishedAt?.toISOString(),
            dateModified: post.updatedAt.toISOString(),
            author: {
              '@type': 'Person',
              name: post.authorName,
            },
            publisher: {
              '@type': 'Organization',
              name: siteConfig.name,
              url: siteConfig.url,
            },
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': postUrl,
            },
          }),
        }}
      />

      {/* Structured Data - Breadcrumbs */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Home', item: siteConfig.url },
              { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteConfig.url}/blog` },
              { '@type': 'ListItem', position: 3, name: post.category.name, item: `${siteConfig.url}/blog?category=${post.categorySlug}` },
              { '@type': 'ListItem', position: 4, name: post.title, item: postUrl },
            ],
          }),
        }}
      />

      {/* Structured Data - FAQ (if exists) */}
      {faqItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqItems.map((faq) => ({
                '@type': 'Question',
                name: faq.question,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.answer,
                },
              })),
            }),
          }}
        />
      )}
    </div>
  );
}
