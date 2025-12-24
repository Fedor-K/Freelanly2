/**
 * Migration script: Old Freelanly DB → New Freelanly2 DB
 *
 * Migrates N users (excluding already migrated):
 * - User account (email, name, Stripe)
 * - Job alerts with language pairs
 *
 * Usage: npx tsx scripts/migrate-batch-users.ts [count]
 * Default: 10 users
 */

import { PrismaClient } from '@prisma/client';
import pg from 'pg';

// New DB (Freelanly2)
const prisma = new PrismaClient();

// Old DB connection string
const OLD_DB_URL = 'postgresql://neondb_owner:npg_NZUB6lxeQ1FM@ep-plain-voice-a5vn7mik.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Language mapping: old format → ISO 639-1
const LANGUAGE_MAP: Record<string, string> = {
  'english': 'EN',
  'spanish': 'ES',
  'french': 'FR',
  'german': 'DE',
  'italian': 'IT',
  'portuguese': 'PT',
  'russian': 'RU',
  'chinese': 'ZH',
  'japanese': 'JA',
  'korean': 'KO',
  'arabic': 'AR',
  'turkish': 'TR',
  'polish': 'PL',
  'dutch': 'NL',
  'greek': 'EL',
  'vietnamese': 'VI',
  'swedish': 'SV',
  'ukrainian': 'UK',
  'hindi': 'HI',
  'bengali': 'BN',
  'thai': 'TH',
  'indonesian': 'ID',
  'persian': 'FA',
  'farsi': 'FA',
  'romanian': 'RO',
  'urdu': 'UR',
  'tamil': 'TA',
  'telugu': 'TE',
  'marathi': 'MR',
  'gujarati': 'GU',
  'burmese': 'MY',
  'swahili': 'SW',
};

// WorkType → Category mapping
const WORKTYPE_TO_CATEGORY: Record<string, string> = {
  'translator': 'translation',
  'interpreter': 'translation',
  'linguist': 'translation',
  'localization specialist': 'translation',
  'language specialist': 'translation',
  'mtpe': 'translation',
  'mtpe (machine translation post-editing)': 'translation',
  'developer': 'engineering',
  'frontend developer': 'engineering',
  'backend developer': 'engineering',
  'software engineer': 'engineering',
  'content writer': 'writing',
  'copywriter': 'writing',
  'content specialist': 'writing',
  'content strategist': 'writing',
  'qa tester': 'qa',
  'customer support': 'support',
  'virtual assistant': 'operations',
  'designer': 'design',
  '3d designer': 'design',
  'digital marketer': 'marketing',
  'seo specialist': 'marketing',
  'data analyst': 'data',
  'voice over artist': 'creative',
};

function normalizeLanguage(lang: string): string {
  if (!lang) return '';
  const normalized = lang.toLowerCase().trim();
  return LANGUAGE_MAP[normalized] || normalized.toUpperCase().slice(0, 2);
}

function workTypeToCategory(workType: string): string | null {
  if (!workType) return null;
  const normalized = workType.toLowerCase().trim();
  return WORKTYPE_TO_CATEGORY[normalized] || null;
}

interface OldUser {
  id: number;
  email: string;
  full_name: string | null;
  stripe_customer_id: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  subscription_ends_at: Date | null;
}

interface OldJobAlert {
  id: number;
  user_id: number;
  filters: {
    workType?: string;
    sourceLanguage?: string;
    targetLanguage?: string;
  };
  is_active: boolean;
  last_sent_at: Date | null;
}

async function migrateBatchUsers(count: number) {
  console.log(`\n🚀 Starting batch migration for ${count} users\n`);

  const oldPool = new pg.Pool({ connectionString: OLD_DB_URL });

  try {
    // 1. Get already migrated emails
    const migratedUsers = await prisma.user.findMany({
      select: { email: true }
    });
    const migratedEmails = new Set(migratedUsers.map(u => u.email.toLowerCase()));
    console.log(`📋 Already migrated: ${migratedEmails.size} users`);

    // 2. Get users from old DB that haven't been migrated yet
    console.log(`📋 Fetching ${count} users from old DB...`);
    const usersResult = await oldPool.query<OldUser>(
      `SELECT id, email, full_name, stripe_customer_id, subscription_id,
              subscription_status, subscription_ends_at
       FROM users
       ORDER BY id
       LIMIT $1`,
      [count + migratedEmails.size + 10] // fetch extra to filter
    );

    // Filter out already migrated
    const usersToMigrate = usersResult.rows
      .filter(u => !migratedEmails.has(u.email.toLowerCase()))
      .slice(0, count);

    if (usersToMigrate.length === 0) {
      console.log('✅ All users already migrated!');
      return;
    }

    console.log(`\n📝 Will migrate ${usersToMigrate.length} users:\n`);
    usersToMigrate.forEach((u, i) => {
      console.log(`   ${i + 1}. ${u.email} (${u.subscription_status || 'free'})`);
    });
    console.log('');

    let migrated = 0;
    let failed = 0;
    let alertsTotal = 0;

    // 3. Migrate each user
    for (const oldUser of usersToMigrate) {
      try {
        console.log(`\n━━━ Migrating: ${oldUser.email} ━━━`);

        // Map subscription status to plan
        const plan = oldUser.subscription_status === 'active' ? 'PRO' : 'FREE';

        // Create user
        const newUser = await prisma.user.create({
          data: {
            email: oldUser.email,
            name: oldUser.full_name,
            stripeId: oldUser.stripe_customer_id,
            stripeSubscriptionId: oldUser.subscription_id,
            plan: plan as any,
            subscriptionEndsAt: oldUser.subscription_ends_at,
          }
        });

        console.log(`   ✅ Created user (ID: ${newUser.id}, Plan: ${plan})`);

        // Fetch and migrate alerts
        const alertsResult = await oldPool.query<OldJobAlert>(
          `SELECT id, user_id, filters, is_active, last_sent_at
           FROM job_alerts WHERE user_id = $1`,
          [oldUser.id]
        );

        for (const oldAlert of alertsResult.rows) {
          const filters = oldAlert.filters || {};
          const category = workTypeToCategory(filters.workType || '');
          const keywords = filters.workType || null;

          // Use upsert to handle duplicates (unique constraint on userId, email, category, keywords)
          const newAlert = await prisma.jobAlert.upsert({
            where: {
              userId_email_category_keywords: {
                userId: newUser.id,
                email: newUser.email,
                category: category,
                keywords: keywords,
              },
            },
            update: {
              isActive: oldAlert.is_active,
              lastSentAt: oldAlert.last_sent_at,
            },
            create: {
              email: newUser.email,
              userId: newUser.id,
              category: category,
              keywords: keywords,
              isActive: oldAlert.is_active,
              lastSentAt: oldAlert.last_sent_at,
              frequency: 'DAILY',
            },
          });

          // Create language pair if present (use upsert to handle duplicates)
          if (filters.sourceLanguage && filters.targetLanguage) {
            const sourceLang = normalizeLanguage(filters.sourceLanguage);
            const targetLang = normalizeLanguage(filters.targetLanguage);

            await prisma.alertLanguagePair.upsert({
              where: {
                jobAlertId_translationType_sourceLanguage_targetLanguage: {
                  jobAlertId: newAlert.id,
                  translationType: 'WRITTEN',
                  sourceLanguage: sourceLang,
                  targetLanguage: targetLang,
                },
              },
              update: {},
              create: {
                jobAlertId: newAlert.id,
                translationType: 'WRITTEN',
                sourceLanguage: sourceLang,
                targetLanguage: targetLang,
              },
            });
          }

          alertsTotal++;
        }

        if (alertsResult.rows.length > 0) {
          console.log(`   ✅ Migrated ${alertsResult.rows.length} alerts`);
        }

        migrated++;

      } catch (error) {
        console.error(`   ❌ Failed to migrate ${oldUser.email}:`, error);
        failed++;
      }
    }

    console.log('\n' + '═'.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('═'.repeat(50));
    console.log(`   ✅ Migrated: ${migrated} users`);
    console.log(`   ❌ Failed: ${failed} users`);
    console.log(`   📧 Alerts: ${alertsTotal} total`);
    console.log('═'.repeat(50));

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await oldPool.end();
    await prisma.$disconnect();
  }
}

// Main
const count = parseInt(process.argv[2] || '10', 10);

migrateBatchUsers(count).catch((error) => {
  console.error(error);
  process.exit(1);
});
