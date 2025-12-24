/**
 * Migration script: Old linkedin_posts → New Job table
 *
 * Reads posts from old DB and processes them through the existing
 * linkedin-processor pipeline (with all validations, dedup, AI extraction).
 *
 * Usage:
 *   npx tsx scripts/migrate-posts.ts --limit 10      # Test with 10 posts
 *   npx tsx scripts/migrate-posts.ts --limit 100    # Migrate 100 posts
 *   npx tsx scripts/migrate-posts.ts                # Migrate all (< 30 days)
 */

import { PrismaClient } from '@prisma/client';
import pg from 'pg';

// Import the processor function (we need to use require for this script)
// Note: This script must be run from the project root with proper TS config

const prisma = new PrismaClient();

// Old DB connection string
const OLD_DB_URL = 'postgresql://neondb_owner:npg_NZUB6lxeQ1FM@ep-plain-voice-a5vn7mik.us-east-2.aws.neon.tech/neondb?sslmode=require';

// LinkedIn post from old DB
interface OldLinkedInPost {
  id: number;
  post_url: string;
  post_content: string;
  post_date: Date;
  author_name: string | null;
  author_linkedin_url: string | null;
  author_type: string | null;
  author_avatar_url: string | null;
  extracted_email: string | null;
  extracted_company: string | null;
  company_domain: string | null;
  standardized_title: string | null;
  detected_work_type: string | null;
  language_pairs: string[] | null;
  all_work_types: string[] | null;
  status: string;
}

// LinkedInPost format expected by processor
interface LinkedInPost {
  id: string;
  url: string;
  content: string;
  authorName: string;
  authorLinkedInUrl: string;
  authorPublicIdentifier: string;
  authorType: 'profile' | 'company';
  authorHeadline: string | null;
  authorAvatar: string | null;
  authorWebsite: string | null;
  postedAt: Date;
  postedAtTimestamp: number;
  images: string[];
}

// Transform old post to new format
function transformOldPost(old: OldLinkedInPost): LinkedInPost {
  return {
    id: `old-${old.id}`, // Prefix to distinguish from new posts
    url: old.post_url,
    content: old.post_content,
    authorName: old.author_name || 'Unknown',
    authorLinkedInUrl: old.author_linkedin_url || '',
    authorPublicIdentifier: old.author_linkedin_url?.split('/in/')?.[1]?.replace(/\/$/, '') || 'unknown',
    authorType: old.author_type === 'company' ? 'company' : 'profile',
    authorHeadline: old.detected_work_type || null,
    authorAvatar: old.author_avatar_url,
    authorWebsite: old.company_domain ? `https://${old.company_domain}` : null,
    postedAt: old.post_date,
    postedAtTimestamp: old.post_date.getTime(),
    images: [],
  };
}

async function migratePosts(limit?: number) {
  console.log('\n🚀 Starting posts migration from old DB\n');

  // Connect to old DB
  const oldPool = new pg.Pool({ connectionString: OLD_DB_URL });

  // Calculate 30 days ago
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    // 1. Count posts to migrate
    const countResult = await oldPool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM linkedin_posts
       WHERE post_date >= $1 AND status = 'active'`,
      [thirtyDaysAgo]
    );
    const totalPosts = parseInt(countResult.rows[0].count);
    console.log(`📊 Total posts available (< 30 days, active): ${totalPosts}`);

    // 2. Fetch posts
    const limitClause = limit ? `LIMIT ${limit}` : '';
    console.log(`📥 Fetching ${limit || 'all'} posts...`);

    const postsResult = await oldPool.query<OldLinkedInPost>(
      `SELECT
        id, post_url, post_content, post_date,
        author_name, author_linkedin_url, author_type, author_avatar_url,
        extracted_email, extracted_company, company_domain,
        standardized_title, detected_work_type, language_pairs, all_work_types, status
       FROM linkedin_posts
       WHERE post_date >= $1 AND status = 'active'
       ORDER BY post_date DESC
       ${limitClause}`,
      [thirtyDaysAgo]
    );

    const posts = postsResult.rows;
    console.log(`✅ Fetched ${posts.length} posts\n`);

    // 3. Import the processor dynamically
    console.log('📦 Loading linkedin-processor...');
    const { processLinkedInPost } = await import('../src/services/linkedin-processor');

    // 4. Process each post
    const stats = {
      total: posts.length,
      processed: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const oldPost of posts) {
      try {
        stats.processed++;
        const progress = `[${stats.processed}/${stats.total}]`;

        // Check if already migrated (by sourceUrl)
        const existing = await prisma.job.findFirst({
          where: { sourceUrl: oldPost.post_url }
        });

        if (existing) {
          console.log(`${progress} ⏭️  Already exists: ${oldPost.post_url.slice(0, 50)}...`);
          stats.skipped++;
          continue;
        }

        // Transform to new format
        const transformedPost = transformOldPost(oldPost);

        // Process through the pipeline
        console.log(`${progress} 🔄 Processing: ${oldPost.standardized_title || oldPost.post_content.slice(0, 40)}...`);
        const result = await processLinkedInPost(transformedPost);

        if (result.success) {
          console.log(`${progress} ✅ Created: ${result.jobSlug}`);
          stats.created++;
        } else if (result.error === 'duplicate') {
          console.log(`${progress} ⏭️  Duplicate`);
          stats.skipped++;
        } else {
          console.log(`${progress} ❌ Failed: ${result.error}`);
          stats.failed++;
          stats.errors.push(`Post ${oldPost.id}: ${result.error}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        stats.failed++;
        const errorMsg = error instanceof Error ? error.message : String(error);
        stats.errors.push(`Post ${oldPost.id}: ${errorMsg}`);
        console.log(`[${stats.processed}/${stats.total}] ❌ Error: ${errorMsg}`);
      }
    }

    // 5. Print summary
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total processed: ${stats.processed}`);
    console.log(`Created:         ${stats.created}`);
    console.log(`Skipped (dupe):  ${stats.skipped}`);
    console.log(`Failed:          ${stats.failed}`);

    if (stats.errors.length > 0 && stats.errors.length <= 10) {
      console.log('\n❌ Errors:');
      stats.errors.forEach(e => console.log(`  - ${e}`));
    } else if (stats.errors.length > 10) {
      console.log(`\n❌ ${stats.errors.length} errors (showing first 10):`);
      stats.errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
    }

    return stats;

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await oldPool.end();
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let limit: number | undefined;

const limitIndex = args.indexOf('--limit');
if (limitIndex !== -1 && args[limitIndex + 1]) {
  limit = parseInt(args[limitIndex + 1]);
  if (isNaN(limit) || limit <= 0) {
    console.error('Error: --limit must be a positive number');
    process.exit(1);
  }
}

// Run migration
migratePosts(limit)
  .then((stats) => {
    console.log('\n✅ Migration completed!');
    process.exit(stats.failed > 0 ? 1 : 0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
