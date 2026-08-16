import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { siteConfig } from '@/config/site';

interface TocItem {
  level: number;
  text: string;
  id: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

interface CreateBlogPostRequest {
  title: string;
  content: string;
  category: string;
  excerpt?: string;
  metaDescription?: string;
  keywords?: string[];
  authorName?: string;
  authorBio?: string;
  authorImage?: string;
  ogImage?: string;
  relatedPosts?: string[];
  publish?: boolean;
  featured?: boolean;
}

/**
 * Create a new blog post
 * POST /api/blog/create
 *
 * Requires admin authentication via CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: CreateBlogPostRequest = await request.json();

    // Validate required fields
    if (!body.title || !body.content || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, content, category' },
        { status: 400 }
      );
    }

    // Ensure category exists or create it
    let category = await prisma.blogCategory.findUnique({
      where: { slug: body.category },
    });

    if (!category) {
      // Create category with default values
      const categoryName = body.category
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      category = await prisma.blogCategory.create({
        data: {
          slug: body.category,
          name: categoryName,
          icon: getCategoryIcon(body.category),
        },
      });
    }

    // Generate slug from title
    const baseSlug = slugify(body.title);
    let slug = baseSlug;
    let counter = 1;

    // Ensure unique slug
    while (await prisma.blogPost.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    // Parse content to extract ToC and FAQ
    const tableOfContents = extractTableOfContents(body.content);
    const faqItems = extractFaqItems(body.content);

    // Calculate reading time (~200 words per minute)
    const wordCount = body.content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    // Generate excerpt if not provided
    const excerpt = body.excerpt || generateExcerpt(body.content);

    // Generate meta description if not provided
    const metaDescription = body.metaDescription || excerpt?.slice(0, 155);

    // Add IDs to headings for ToC navigation
    const contentWithIds = addHeadingIds(body.content);

    // Create the blog post
    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: body.title,
        content: contentWithIds,
        excerpt,
        categorySlug: category.slug,
        metaDescription,
        keywords: body.keywords || [],
        tableOfContents: tableOfContents as unknown as Prisma.InputJsonValue,
        faqItems: faqItems.length > 0 ? (faqItems as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        readingTime,
        authorName: body.authorName || 'Freelanly Team',
        authorBio: body.authorBio,
        authorImage: body.authorImage,
        ogImage: body.ogImage || `${siteConfig.url}/api/og/blog?title=${encodeURIComponent(body.title)}&category=${encodeURIComponent(category.name)}`,
        relatedPosts: body.relatedPosts || [],
        status: body.publish ? 'PUBLISHED' : 'DRAFT',
        publishedAt: body.publish ? new Date() : null,
        featuredAt: body.featured ? new Date() : null,
      },
      include: { category: true },
    });

    // Update category post count
    await prisma.blogCategory.update({
      where: { slug: category.slug },
      data: {
        postCount: {
          increment: body.publish ? 1 : 0,
        },
      },
    });

    console.log(`[Blog] Created post: ${post.title} (${post.slug})`);

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        url: `${siteConfig.url}/blog/${post.slug}`,
        status: post.status,
        category: post.category.name,
        readingTime: post.readingTime,
        tableOfContents: post.tableOfContents,
        faqCount: faqItems.length,
      },
    });
  } catch (error) {
    console.error('[Blog] Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create blog post', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get category icon based on slug
 */
function getCategoryIcon(slug: string): string {
  const icons: Record<string, string> = {
    'remote-job-hunting': '🔍',
    'salary-guides': '💰',
    'remote-work-tips': '💡',
    'company-spotlights': '🏢',
    'digital-nomad': '🌍',
    'industry-reports': '📊',
    'career-advice': '🎯',
    'interviews': '🎤',
  };
  return icons[slug] || '📝';
}

/**
 * Extract table of contents from HTML content
 */
function extractTableOfContents(content: string): TocItem[] {
  const headingRegex = /<h([2-3])[^>]*>([^<]+)<\/h[2-3]>/gi;
  const items: TocItem[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1], 10);
    const text = match[2].trim();
    const id = slugify(text);

    items.push({ level, text, id });
  }

  return items;
}

/**
 * Extract FAQ items from content
 * Looks for patterns like:
 * **Question?**
 * Answer text
 *
 * Or:
 * <strong>Question?</strong>
 * <p>Answer text</p>
 */
function extractFaqItems(content: string): FaqItem[] {
  const faqItems: FaqItem[] = [];

  // Pattern 1: Markdown-style **Question?** followed by answer
  const markdownPattern = /\*\*([^*]+\?)\*\*\s*\n+([^*\n][^\n]+)/g;
  let match: RegExpExecArray | null;

  while ((match = markdownPattern.exec(content)) !== null) {
    faqItems.push({
      question: match[1].trim(),
      answer: match[2].trim(),
    });
  }

  // Pattern 2: HTML-style <strong>Question?</strong> followed by <p>
  const htmlPattern = /<strong>([^<]+\?)<\/strong>\s*<p>([^<]+)<\/p>/gi;

  while ((match = htmlPattern.exec(content)) !== null) {
    const question = match[1].trim();
    const answer = match[2].trim();
    // Avoid duplicates
    if (!faqItems.some((faq) => faq.question === question)) {
      faqItems.push({ question, answer });
    }
  }

  return faqItems;
}

/**
 * Add IDs to headings for ToC navigation
 */
function addHeadingIds(content: string): string {
  return content.replace(/<h([2-3])([^>]*)>([^<]+)<\/h[2-3]>/gi, (match, level, attrs, text) => {
    const id = slugify(text.trim());
    // Check if id already exists
    if (attrs.includes('id=')) {
      return match;
    }
    return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
  });
}

/**
 * Generate excerpt from content
 */
function generateExcerpt(content: string, maxLength: number = 160): string {
  // Strip HTML tags
  const text = content.replace(/<[^>]*>/g, '');
  // Get first paragraph
  const firstParagraph = text.split(/\n\n/)[0] || text;
  // Truncate
  if (firstParagraph.length <= maxLength) {
    return firstParagraph;
  }
  return firstParagraph.slice(0, maxLength - 3).trim() + '...';
}
