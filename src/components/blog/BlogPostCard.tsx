'use client';

import Link from 'next/link';
import { Clock, Calendar } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface BlogPostCardProps {
  post: {
    slug: string;
    title: string;
    excerpt: string | null;
    ogImage: string | null;
    readingTime: number;
    publishedAt: Date | null;
    category: {
      slug: string;
      name: string;
      icon: string | null;
    };
  };
  featured?: boolean;
}

/**
 * Dark text card matching the landing design (2026-07-23). Cover images dropped on purpose —
 * the legacy AI-stock covers (incl. one with garbled "Reemot Develoiper's" text baked in)
 * looked cheaper than plain typography.
 */
export function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block group h-full rounded-2xl p-6 transition-colors hover:bg-white/[0.04]"
      style={{ border: featured ? '1px solid rgba(199,249,74,0.25)' : '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="font-mono text-[11px] tracking-[0.06em] uppercase mb-3" style={{ color: '#C7F94A' }}>
        {post.category.name}
      </div>
      <h3 className={`font-semibold mb-2 line-clamp-2 text-[#FAFAFA] group-hover:text-[#C7F94A] transition-colors ${featured ? 'text-xl' : 'text-lg'}`}>
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="text-[#A1A1AA] text-sm line-clamp-2 mb-4 leading-relaxed">{post.excerpt}</p>
      )}
      <div className="flex items-center gap-4 font-mono text-[11px] text-[#6B7280]">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{post.readingTime} min read</span>
        {post.publishedAt && (
          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDistanceToNow(post.publishedAt)}</span>
        )}
      </div>
    </Link>
  );
}
