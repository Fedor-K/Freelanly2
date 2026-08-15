import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { TableOfContents } from '@/components/blog/TableOfContents';
import { BlogPostCard } from '@/components/blog/BlogPostCard';
import { MarketingNav, MarketingFooter } from '@/components/marketing/MarketingShell';
import { Clock, Calendar, Share2, ArrowLeft } from 'lucide-react';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';
import { formatDistanceToNow } from '@/lib/utils';
import { renderMarkdown, extractToc } from '@/lib/markdown';
import { truncateTitle } from '@/lib/seo';

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
    where: { slug, status: 'PUBLISHED' },
    include: { category: true },
  });

  // Do NOT call notFound() here. Metadata resolves outside the render pass that sets the status
  // code, so throwing from generateMetadata rendered the 404 page with a 200 — a soft 404, which
  // search engines index as a real page. The page component below throws instead, which does set
  // the status; this only has to return safe metadata for a page that will never be shown.
  if (!post) {
    return { title: 'Not found — Freelanly', robots: { index: false, follow: false } };
  }

  const title = truncateTitle(post.metaTitle || post.title);
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
  const tocItems = extractToc(post.content);
  const faqItems = (post.faqItems as { question: string; answer: string }[]) || [];
  const postUrl = `${siteConfig.url}/blog/${post.slug}`;

  return (
    <div className="min-h-screen" style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      <main className="pt-28 pb-4">
        <article className="max-w-[1240px] mx-auto px-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-sm text-[#6B7280]">
            <Link href="/" className="hover:text-white">Home</Link>
            {' / '}
            <Link href="/blog" className="hover:text-white">Blog</Link>
            {' / '}
            <Link href={`/blog/category/${post.categorySlug}`} className="hover:text-white">
              {post.category.name}
            </Link>
            {' / '}
            <span className="text-[#A1A1AA]">{post.title}</span>
          </nav>

          {/* Back link */}
          <Link href="/blog" className="inline-flex items-center text-sm text-[#A1A1AA] hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Blog
          </Link>

          <div className="grid lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {/* Header */}
              <header className="mb-8">
                <div className="font-mono text-[11px] tracking-[0.06em] uppercase mb-4" style={{ color: '#C7F94A' }}>{post.category.name}</div>

                <h1 className="text-[clamp(30px,3.6vw,44px)] font-semibold tracking-tighter mb-4">{post.title}</h1>

                {post.excerpt && (
                  <p className="text-lg text-[#A1A1AA] mb-4">{post.excerpt}</p>
                )}

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#6B7280]">
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

              {/* Legacy AI-stock covers dropped (2026-07-23) — typography-first like the landing. */}

              {/* Mobile ToC */}
              {tocItems.length > 0 && (
                <div className="lg:hidden mb-8 p-4 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                  <TableOfContents items={tocItems} />
                </div>
              )}

              {/* Article Content */}
              <div
                className="prose prose-lg prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:text-[#C7F94A]"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
              />

              {/* Share */}
              <div className="my-8" style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Share2 className="w-4 h-4" />
                  <span className="font-medium">Share this article</span>
                </div>
                <div className="flex gap-2">
                  <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                    Twitter
                  </a>
                  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-4 py-1.5 rounded-full text-[13px] hover:bg-white/5" style={{ border: '1px solid rgba(255,255,255,0.14)' }}>
                    LinkedIn
                  </a>
                </div>
              </div>

              {/* Author Bio */}
              {post.authorBio && (
                <>
                  <div className="my-8" style={{ height: 1, background: 'rgba(255,255,255,0.1)' }} />
                  <div className="flex items-start gap-4 p-6 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
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
                      <p className="text-sm text-[#A1A1AA]">{post.authorBio}</p>
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
                  <div className="p-4 rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                    <TableOfContents items={tocItems} />
                  </div>
                )}

                {/* CTA */}
                <div className="p-4 rounded-lg" style={{ border: '1px solid rgba(199,249,74,0.25)', background: 'rgba(199,249,74,0.05)' }}>
                  <h4 className="font-semibold mb-2">Apply smarter, not longer</h4>
                  <p className="text-sm text-[#A1A1AA] mb-4">
                    Freelanly matches you to fresh remote tech roles and drafts the cover letter — you review and send.
                  </p>
                  <Link href="/auth/signin" className="block text-center px-4 py-2.5 rounded-full font-semibold text-[14px]" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link>
                </div>
              </div>
            </aside>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <section className="mt-16">
              <h2 className="font-mono text-xs tracking-widest uppercase text-[#6B7280] mb-6">Related articles</h2>
              <div className="grid md:grid-cols-3 gap-6">
                {relatedPosts.map((relatedPost) => (
                  <BlogPostCard key={relatedPost.id} post={relatedPost} />
                ))}
              </div>
            </section>
          )}

          {/* Product CTA */}
          <section className="mt-16 rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 className="text-2xl font-semibold mb-2">Spend the saved hour on real work</h2>
            <p className="text-[#A1A1AA] mb-5">
              Freelanly finds matched remote tech roles and drafts every application — you review and send. The first two are free.
            </p>
            <Link href="/auth/signin" className="inline-flex px-6 py-3 rounded-full font-semibold text-[15px]" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free →</Link>
          </section>
        </article>
      </main>

      <MarketingFooter />

      {/* Structured Data - Article */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: post.title,
            description: post.excerpt || post.metaDescription,
            inLanguage: 'en',
            url: postUrl,
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
              { '@type': 'ListItem', position: 3, name: post.category.name, item: `${siteConfig.url}/blog/category/${post.categorySlug}` },
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
