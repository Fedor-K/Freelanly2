/**
 * Backfill structured descriptions for existing jobs
 *
 * This script extracts structured bullets (summaryBullets, requirementBullets, benefitBullets)
 * from existing job descriptions using DeepSeek AI.
 *
 * Usage:
 *   npx tsx scripts/backfill-structured-descriptions.ts [limit]
 *
 * Examples:
 *   npx tsx scripts/backfill-structured-descriptions.ts       # Process all jobs
 *   npx tsx scripts/backfill-structured-descriptions.ts 10    # Process first 10 jobs (test)
 */

import { prisma } from '../src/lib/db';
import OpenAI from 'openai';

// DeepSeek client
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

interface StructuredBullets {
  summaryBullets: string[];
  requirementBullets: string[];
  benefitBullets: string[];
}

const BULLETS_EXTRACTION_PROMPT = `Extract structured information from this job description. Return a JSON object with these arrays:

- summaryBullets: 5-7 key job responsibilities. Each is 1 sentence, max 15 words. Focus on what the person WILL DO.
- requirementBullets: 5-7 requirements. Include education, experience, skills, qualifications. Each max 15 words.
- benefitBullets: benefits mentioned (salary, perks, culture, work flexibility). Each max 15 words. Empty array if none.

Rules:
- Extract ONLY actionable, job-relevant information
- REMOVE: legal disclaimers, EEO statements, company history, "about us" text, hashtags
- Each bullet starts with action verb or noun (e.g., "Lead...", "3+ years...", "Competitive salary")
- If a section cannot be extracted, return empty array []
- Return ONLY valid JSON, no markdown or explanation.`;

async function extractBullets(content: string): Promise<StructuredBullets | null> {
  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: BULLETS_EXTRACTION_PROMPT },
        { role: 'user', content: content.slice(0, 8000) } // Limit content length
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) return null;

    const data = JSON.parse(responseContent) as StructuredBullets;
    return {
      summaryBullets: data.summaryBullets || [],
      requirementBullets: data.requirementBullets || [],
      benefitBullets: data.benefitBullets || [],
    };
  } catch (error) {
    console.error('DeepSeek extraction error:', error);
    return null;
  }
}

async function backfillJobs(limit?: number) {
  console.log('\n🚀 Starting structured descriptions backfill\n');

  // Find jobs without structured bullets
  const jobs = await prisma.job.findMany({
    where: {
      AND: [
        { summaryBullets: { isEmpty: true } },
        { requirementBullets: { isEmpty: true } },
      ]
    },
    select: {
      id: true,
      title: true,
      description: true,
      originalContent: true,
      sourceType: true,
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  console.log(`📊 Found ${jobs.length} jobs without structured bullets\n`);

  if (jobs.length === 0) {
    console.log('✅ All jobs already have structured bullets!');
    return;
  }

  let processed = 0;
  let updated = 0;
  let failed = 0;

  for (const job of jobs) {
    processed++;
    const content = job.originalContent || job.description;

    if (!content) {
      console.log(`⚠️  [${processed}/${jobs.length}] ${job.title} - No content, skipping`);
      continue;
    }

    console.log(`🔄 [${processed}/${jobs.length}] Processing: ${job.title.slice(0, 50)}...`);

    const bullets = await extractBullets(content);

    if (bullets) {
      const hasContent =
        bullets.summaryBullets.length > 0 ||
        bullets.requirementBullets.length > 0 ||
        bullets.benefitBullets.length > 0;

      if (hasContent) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            summaryBullets: bullets.summaryBullets,
            requirementBullets: bullets.requirementBullets,
            benefitBullets: bullets.benefitBullets,
          },
        });
        updated++;
        console.log(`   ✅ Updated: ${bullets.summaryBullets.length} summary, ${bullets.requirementBullets.length} requirements, ${bullets.benefitBullets.length} benefits`);
      } else {
        console.log(`   ⚠️ No bullets extracted (content may be too short)`);
      }
    } else {
      failed++;
      console.log(`   ❌ Failed to extract bullets`);
    }

    // Rate limiting - 500ms delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n📈 Backfill Summary:');
  console.log(`   Total processed: ${processed}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Skipped: ${processed - updated - failed}`);
}

// Parse command line arguments
const limit = process.argv[2] ? parseInt(process.argv[2]) : undefined;

if (limit) {
  console.log(`📌 Limiting to ${limit} jobs (test mode)`);
}

backfillJobs(limit)
  .then(() => {
    console.log('\n✅ Backfill completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
