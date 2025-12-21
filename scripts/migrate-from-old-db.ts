/**
 * Migration script: Old DB → New DB
 * Migrates: users, linkedin_posts (→ Jobs), companies
 *
 * Run: npx tsx scripts/migrate-from-old-db.ts
 */

import { PrismaClient, Plan, Source, SourceType, Level, JobType, LocationType } from '@prisma/client';

const OLD_DB_URL = 'postgresql://neondb_owner:npg_4yrSlM1RVCEi@ep-falling-mouse-a48a4w6b-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require';
const NEW_DB_URL = 'postgresql://neondb_owner:npg_P4kEWCj6RdIa@ep-noisy-tooth-ahj8gt6v-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require';

// Old DB client (raw queries)
const oldDb = new PrismaClient({
  datasources: { db: { url: OLD_DB_URL } }
});

// New DB client (Prisma models)
const newDb = new PrismaClient({
  datasources: { db: { url: NEW_DB_URL } }
});

// ============================================
// TYPE DEFINITIONS FOR OLD DB
// ============================================

interface OldUser {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  created_at: Date;
  stripe_customer_id: string | null;
  subscription_status: string | null;
  avatar_url: string | null;
}

interface OldLinkedInPost {
  id: number;
  post_url: string;
  post_content: string | null;
  post_date: Date | null;
  standardized_title: string | null;
  extracted_company: string | null;
  company_domain: string | null;
  company_slug: string | null;
  location: string | null;
  job_type: string | null;
  extracted_skills: string[] | null;
  extracted_email: string | null;
  author_linkedin_url: string | null;
  author_name: string | null;
  slug: string | null;
  status: string;
  valid_through: Date | null;
  remote_work: boolean | null;
  created_at: Date;
  about_role: string | null;
}

interface OldCompany {
  domain: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website: string | null;
  industry: string | null;
  location: string | null;
  slug: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function mapSubscriptionToPlan(status: string | null): Plan {
  if (!status) return Plan.FREE;
  const s = status.toLowerCase();
  if (s === 'active' || s === 'trialing') return Plan.PRO;
  if (s === 'enterprise') return Plan.ENTERPRISE;
  return Plan.FREE;
}

function mapJobType(type: string | null): JobType {
  if (!type) return JobType.FULL_TIME;
  const t = type.toLowerCase();
  if (t.includes('part')) return JobType.PART_TIME;
  if (t.includes('contract')) return JobType.CONTRACT;
  if (t.includes('freelance')) return JobType.FREELANCE;
  if (t.includes('intern')) return JobType.INTERNSHIP;
  return JobType.FULL_TIME;
}

function guessLevel(title: string | null): Level {
  if (!title) return Level.MID;
  const t = title.toLowerCase();
  if (t.includes('intern')) return Level.INTERN;
  if (t.includes('junior') || t.includes('jr')) return Level.JUNIOR;
  if (t.includes('senior') || t.includes('sr')) return Level.SENIOR;
  if (t.includes('lead')) return Level.LEAD;
  if (t.includes('manager')) return Level.MANAGER;
  if (t.includes('director')) return Level.DIRECTOR;
  if (t.includes('vp') || t.includes('chief') || t.includes('cto') || t.includes('ceo')) return Level.EXECUTIVE;
  if (t.includes('entry')) return Level.ENTRY;
  return Level.MID;
}

// ============================================
// MIGRATION FUNCTIONS
// ============================================

async function migrateUsers() {
  console.log('\n👤 Migrating users...');

  const oldUsers = await oldDb.$queryRaw<OldUser[]>`
    SELECT id, username, email, full_name, created_at,
           stripe_customer_id, subscription_status, avatar_url
    FROM users
    WHERE email IS NOT NULL
  `;

  console.log(`Found ${oldUsers.length} users to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const oldUser of oldUsers) {
    try {
      // Check if user already exists
      const existing = await newDb.user.findUnique({
        where: { email: oldUser.email }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await newDb.user.create({
        data: {
          email: oldUser.email,
          name: oldUser.full_name || oldUser.username,
          image: oldUser.avatar_url,
          stripeId: oldUser.stripe_customer_id,
          plan: mapSubscriptionToPlan(oldUser.subscription_status),
          createdAt: oldUser.created_at || new Date(),
        }
      });

      migrated++;
    } catch (error) {
      console.error(`Error migrating user ${oldUser.email}:`, error);
    }
  }

  console.log(`✓ Users migrated: ${migrated}, skipped: ${skipped}`);
  return migrated;
}

async function migrateCompanies() {
  console.log('\n🏢 Migrating companies...');

  const oldCompanies = await oldDb.$queryRaw<OldCompany[]>`
    SELECT domain, name, description, logo_url, website, industry, location, slug
    FROM companies
    WHERE name IS NOT NULL
  `;

  console.log(`Found ${oldCompanies.length} companies to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const oldCompany of oldCompanies) {
    try {
      const companySlug = oldCompany.slug || slugify(oldCompany.name);

      // Check if company already exists
      const existing = await newDb.company.findFirst({
        where: {
          OR: [
            { slug: companySlug },
            { name: { equals: oldCompany.name, mode: 'insensitive' } }
          ]
        }
      });

      if (existing) {
        skipped++;
        continue;
      }

      await newDb.company.create({
        data: {
          slug: companySlug,
          name: oldCompany.name,
          description: oldCompany.description,
          logo: oldCompany.logo_url,
          website: oldCompany.website || (oldCompany.domain ? `https://${oldCompany.domain}` : null),
          industry: oldCompany.industry,
        }
      });

      migrated++;
    } catch (error) {
      console.error(`Error migrating company ${oldCompany.name}:`, error);
    }
  }

  console.log(`✓ Companies migrated: ${migrated}, skipped: ${skipped}`);
  return migrated;
}

async function migrateLinkedInPosts() {
  console.log('\n📋 Migrating linkedin_posts → Jobs...');

  // Get default category (support)
  let defaultCategory = await newDb.category.findFirst({
    where: { slug: 'support' }
  });

  if (!defaultCategory) {
    // Create default category if not exists
    defaultCategory = await newDb.category.create({
      data: {
        slug: 'support',
        name: 'Support',
        description: 'Customer support and service roles'
      }
    });
  }

  const oldPosts = await oldDb.$queryRaw<OldLinkedInPost[]>`
    SELECT id, post_url, post_content, post_date, standardized_title,
           extracted_company, company_domain, company_slug, location,
           job_type, extracted_skills, extracted_email, author_linkedin_url,
           author_name, slug, status, valid_through, remote_work, created_at,
           about_role
    FROM linkedin_posts
    WHERE status = 'active' OR status IS NULL
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  console.log(`Found ${oldPosts.length} posts to migrate`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of oldPosts) {
    try {
      // Skip if no title
      if (!post.standardized_title && !post.post_content) {
        skipped++;
        continue;
      }

      const title = post.standardized_title || 'Untitled Position';
      const jobSlug = post.slug || slugify(`${title}-${post.id}`);

      // Check if job already exists
      const existingJob = await newDb.job.findFirst({
        where: {
          OR: [
            { slug: jobSlug },
            { sourceUrl: post.post_url }
          ]
        }
      });

      if (existingJob) {
        skipped++;
        continue;
      }

      // Find or create company
      let company = null;
      const companyName = post.extracted_company || 'Unknown Company';
      const companySlug = post.company_slug || slugify(companyName);

      company = await newDb.company.findFirst({
        where: {
          OR: [
            { slug: companySlug },
            { name: { equals: companyName, mode: 'insensitive' } }
          ]
        }
      });

      if (!company) {
        company = await newDb.company.create({
          data: {
            slug: companySlug,
            name: companyName,
            website: post.company_domain ? `https://${post.company_domain}` : null,
          }
        });
      }

      // Parse skills
      let skills: string[] = [];
      if (post.extracted_skills) {
        if (Array.isArray(post.extracted_skills)) {
          skills = post.extracted_skills;
        } else if (typeof post.extracted_skills === 'string') {
          try {
            skills = JSON.parse(post.extracted_skills);
          } catch {
            skills = [];
          }
        }
      }

      // Create job
      await newDb.job.create({
        data: {
          slug: jobSlug,
          title: title,
          description: post.about_role || post.post_content || '',
          companyId: company.id,
          categoryId: defaultCategory.id,
          location: post.location || 'Remote',
          locationType: post.remote_work ? LocationType.REMOTE : LocationType.REMOTE,
          level: guessLevel(title),
          type: mapJobType(post.job_type),
          skills: skills.slice(0, 10), // Limit to 10 skills
          source: Source.LINKEDIN,
          sourceType: SourceType.UNSTRUCTURED,
          sourceUrl: post.post_url,
          originalContent: post.post_content,
          authorLinkedIn: post.author_linkedin_url,
          authorName: post.author_name,
          applyEmail: post.extracted_email,
          qualityScore: 50,
          isActive: post.status === 'active' || post.status === null,
          postedAt: post.post_date || post.created_at || new Date(),
          expiresAt: post.valid_through,
          createdAt: post.created_at || new Date(),
        }
      });

      migrated++;

      if (migrated % 100 === 0) {
        console.log(`  Migrated ${migrated} jobs...`);
      }
    } catch (error) {
      errors++;
      if (errors < 10) {
        console.error(`Error migrating post ${post.id}:`, error);
      }
    }
  }

  console.log(`✓ Jobs migrated: ${migrated}, skipped: ${skipped}, errors: ${errors}`);
  return migrated;
}

async function migrateJobAlerts() {
  console.log('\n🔔 Migrating job_alerts...');

  interface OldJobAlert {
    id: number;
    user_id: number;
    is_active: boolean;
    filters: Record<string, unknown> | null;
    created_at: Date;
  }

  interface UserEmail {
    id: number;
    email: string;
  }

  const oldAlerts = await oldDb.$queryRaw<OldJobAlert[]>`
    SELECT ja.id, ja.user_id, ja.is_active, ja.filters, ja.created_at
    FROM job_alerts ja
    WHERE ja.is_active = true
  `;

  console.log(`Found ${oldAlerts.length} job alerts to migrate`);

  let migrated = 0;
  let skipped = 0;

  for (const alert of oldAlerts) {
    try {
      // Get user email from old DB
      const users = await oldDb.$queryRaw<UserEmail[]>`
        SELECT id, email FROM users WHERE id = ${alert.user_id}
      `;

      if (!users.length || !users[0].email) {
        skipped++;
        continue;
      }

      const email = users[0].email;

      // Check if already exists in new DB
      const existing = await newDb.jobAlert.findUnique({
        where: { email }
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Extract keywords from filters if available
      const filters = alert.filters || {};
      const keywords = typeof filters === 'object' && 'keywords' in filters
        ? String(filters.keywords)
        : null;

      await newDb.jobAlert.create({
        data: {
          email,
          keywords,
          isActive: alert.is_active,
          createdAt: alert.created_at || new Date(),
        }
      });

      migrated++;
    } catch (error) {
      console.error(`Error migrating job alert ${alert.id}:`, error);
    }
  }

  console.log(`✓ Job alerts migrated: ${migrated}, skipped: ${skipped}`);
  return migrated;
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 Starting migration from old DB to new DB\n');
  console.log('OLD DB:', OLD_DB_URL.replace(/:[^:@]+@/, ':***@'));
  console.log('NEW DB:', NEW_DB_URL.replace(/:[^:@]+@/, ':***@'));

  try {
    // Test connections
    console.log('\nTesting connections...');
    await oldDb.$queryRaw`SELECT 1`;
    console.log('✓ Old DB connected');
    await newDb.$queryRaw`SELECT 1`;
    console.log('✓ New DB connected');

    // Run migrations in order
    const userCount = await migrateUsers();
    const companyCount = await migrateCompanies();
    const jobCount = await migrateLinkedInPosts();
    const alertCount = await migrateJobAlerts();

    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETE');
    console.log('='.repeat(50));
    console.log(`Users migrated:     ${userCount}`);
    console.log(`Companies migrated: ${companyCount}`);
    console.log(`Jobs migrated:      ${jobCount}`);
    console.log(`Job alerts migrated: ${alertCount}`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await oldDb.$disconnect();
    await newDb.$disconnect();
  }
}

main();
