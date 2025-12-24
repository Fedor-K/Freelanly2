/**
 * Migration script: Old Freelanly DB → New Freelanly2 DB
 *
 * Migrates a single user for testing:
 * - User account (email, name, Stripe)
 * - Job alerts with language pairs
 *
 * Usage: npx tsx scripts/migrate-single-user.ts user@email.com
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

async function migrateUser(email: string) {
  console.log(`\n🚀 Starting migration for: ${email}\n`);

  // Connect to old DB
  const oldPool = new pg.Pool({ connectionString: OLD_DB_URL });

  try {
    // 1. Find user in old DB
    console.log('📋 Fetching user from old DB...');
    const userResult = await oldPool.query<OldUser>(
      `SELECT id, email, full_name, stripe_customer_id, subscription_id,
              subscription_status, subscription_ends_at
       FROM users WHERE email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      console.error(`❌ User not found in old DB: ${email}`);
      return;
    }

    const oldUser = userResult.rows[0];
    console.log(`✅ Found user: ${oldUser.email} (ID: ${oldUser.id})`);
    console.log(`   Name: ${oldUser.full_name || '(not set)'}`);
    console.log(`   Stripe: ${oldUser.stripe_customer_id || '(none)'}`);
    console.log(`   Subscription: ${oldUser.subscription_status || 'none'}`);

    // 2. Check if user already exists in new DB
    const existingUser = await prisma.user.findUnique({
      where: { email: oldUser.email }
    });

    if (existingUser) {
      console.log(`⚠️  User already exists in new DB (ID: ${existingUser.id})`);
      console.log('   Skipping user creation, will migrate alerts only...');
    }

    // 3. Create user in new DB
    let newUser;
    if (!existingUser) {
      console.log('\n📝 Creating user in new DB...');

      // Map subscription status to plan
      const plan = oldUser.subscription_status === 'active' ? 'PRO' : 'FREE';

      newUser = await prisma.user.create({
        data: {
          email: oldUser.email,
          name: oldUser.full_name,
          stripeId: oldUser.stripe_customer_id,
          stripeSubscriptionId: oldUser.subscription_id,
          plan: plan as any,
          subscriptionEndsAt: oldUser.subscription_ends_at,
        }
      });

      console.log(`✅ Created user in new DB (ID: ${newUser.id})`);
      console.log(`   Plan: ${plan}`);
    } else {
      newUser = existingUser;
    }

    // 4. Fetch job alerts from old DB
    console.log('\n📋 Fetching job alerts from old DB...');
    const alertsResult = await oldPool.query<OldJobAlert>(
      `SELECT id, user_id, filters, is_active, last_sent_at
       FROM job_alerts WHERE user_id = $1`,
      [oldUser.id]
    );

    console.log(`   Found ${alertsResult.rows.length} alerts`);

    // 5. Migrate each alert
    for (const oldAlert of alertsResult.rows) {
      console.log(`\n   Migrating alert ID ${oldAlert.id}...`);
      console.log(`   Filters: ${JSON.stringify(oldAlert.filters)}`);

      const filters = oldAlert.filters || {};
      const category = workTypeToCategory(filters.workType || '');
      const keywords = filters.workType || null;

      // Check if alert already exists
      const existingAlert = await prisma.jobAlert.findFirst({
        where: {
          userId: newUser.id,
          keywords: keywords,
        }
      });

      if (existingAlert) {
        console.log(`   ⚠️  Similar alert already exists, skipping`);
        continue;
      }

      // Create alert
      const newAlert = await prisma.jobAlert.create({
        data: {
          email: newUser.email,
          userId: newUser.id,
          category: category,
          keywords: keywords,
          isActive: oldAlert.is_active,
          lastSentAt: oldAlert.last_sent_at,
          frequency: 'DAILY',
        }
      });

      console.log(`   ✅ Created alert (ID: ${newAlert.id})`);

      // Create language pair if present
      if (filters.sourceLanguage && filters.targetLanguage) {
        const sourceLang = normalizeLanguage(filters.sourceLanguage);
        const targetLang = normalizeLanguage(filters.targetLanguage);

        await prisma.alertLanguagePair.create({
          data: {
            jobAlertId: newAlert.id,
            translationType: 'WRITTEN',
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          }
        });

        console.log(`   ✅ Created language pair: ${sourceLang} → ${targetLang}`);
      }
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   User: ${newUser.email}`);
    console.log(`   User ID (new): ${newUser.id}`);
    console.log(`   Alerts migrated: ${alertsResult.rows.length}`);
    console.log(`\n🔗 Test login at: https://new.freelanly.com/auth/signin`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await oldPool.end();
    await prisma.$disconnect();
  }
}

// Main
const email = process.argv[2];

if (!email) {
  console.log('Usage: npx tsx scripts/migrate-single-user.ts user@email.com');
  process.exit(1);
}

migrateUser(email).catch((error) => {
  console.error(error);
  process.exit(1);
});
