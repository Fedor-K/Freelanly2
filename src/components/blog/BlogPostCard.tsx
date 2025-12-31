'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

export function BlogPostCard({ post, featured = false }: BlogPostCardProps) {
  return (
    <Link href={`/blog/${post.slug}`} className="block group">
      <Card className={`h-full overflow-hidden transition-shadow hover:shadow-lg ${featured ? 'border-2 border-primary/20' : ''}`}>
        {/* Image */}
        {post.ogImage && (
          <div className="aspect-video relative overflow-hidden bg-muted">
            <Image
              src={post.ogImage}
              alt={post.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
            />
          </div>
        )}

        {/* Placeholder if no image */}
        {!post.ogImage && (
          <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <span className="text-4xl">{post.category.icon || '📝'}</span>
          </div>
        )}

        <CardContent className="p-4">
          {/* Category */}
          <Link
            href={`/blog/category/${post.category.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-block mb-2"
          >
            <Badge variant="secondary" className="hover:bg-secondary/80 cursor-pointer">
              {post.category.icon} {post.category.name}
            </Badge>
          </Link>

          {/* Title */}
          <h3 className={`font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors ${featured ? 'text-xl' : 'text-lg'}`}>
            {post.title}
          </h3>

          {/* Excerpt */}
          {post.excerpt && (
            <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
              {post.excerpt}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{post.readingTime} min read</span>
            </div>
            {post.publishedAt && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>{formatDistanceToNow(post.publishedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
