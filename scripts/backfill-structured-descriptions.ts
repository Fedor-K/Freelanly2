/**
 * Backfill clean descriptions for existing jobs
 *
 * This script generates AI-rewritten clean descriptions from existing job posts
 * using DeepSeek AI. It creates structured, readable text without clutter.
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

interface CleanDescriptionResult {
  cleanDescription: string | null;
  summaryBullets: string[];
  requirementBullets: string[];
  benefitBullets: string[];
}

const CLEAN_DESCRIPTION_PROMPT = `Transform this job post into a professional, clean job description.

Return a JSON object with:
- cleanDescription: A professionally rewritten job description text

Format for cleanDescription:
1. Start with "About the Role" paragraph (2-3 sentences summarizing the position)
2. "Key Responsibilities" section with bullet points (use "• " for bullets)
3. "Requirements" section with bullet points
4. "Benefits" section with bullet points (only if mentioned in original)

Rules for cleanDescription:
- Write in professional, clear English
- REMOVE all: emojis, hashtags, excessive punctuation (!!!), promotional phrases ("Amazing opportunity!!!")
- REMOVE: EEO statements, legal disclaimers, "About Us" company history, application instructions
- Keep ONLY job-relevant content: role, responsibilities, requirements, qualifications, benefits
- Use proper capitalization and punctuation
- Each section header on its own line, followed by content
- For bullet points, use "• " prefix
- Keep it concise but comprehensive (aim for 150-300 words)
- If original is too short or lacks structure, write what you can extract professionally

Example format:
"About the Role
We are looking for a Senior Developer to join our team. This role focuses on building scalable backend systems.

Key Responsibilities
• Design and implement RESTful APIs
• Lead code reviews and mentor junior developers
• Collaborate with product team on technical requirements

Requirements
• 5+ years of experience with Python or Node.js
• Strong understanding of database design
• Experience with cloud platforms (AWS, GCP)

Benefits
• Competitive salary and equity
• Remote-first culture
• Health insurance and 401k"

Also include legacy bullet arrays for backwards compatibility:
- summaryBullets: array of 5-7 key responsibilities (max 15 words each)
- requirementBullets: array of 5-7 requirements (max 15 words each)
- benefitBullets: array of benefits mentioned (empty array if none)

Return ONLY valid JSON, no markdown or explanation.`;

async function generateCleanDescription(content: string): Promise<CleanDescriptionResult | null> {
  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: CLEAN_DESCRIPTION_PROMPT },
        { role: 'user', content: content.slice(0, 8000) } // Limit content length
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    const responseContent = response.choices[0]?.message?.content;
    if (!responseContent) return null;

    const data = JSON.parse(responseContent) as CleanDescriptionResult;
    return {
      cleanDescription: data.cleanDescription || null,
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
  console.log('\n🚀 Starting clean description backfill\n');

  // Find jobs without cleanDescription
  const jobs = await prisma.job.findMany({
    where: {
      cleanDescription: null,
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

  console.log(`📊 Found ${jobs.length} jobs without clean description\n`);

  if (jobs.length === 0) {
    console.log('✅ All jobs already have clean descriptions!');
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

    const result = await generateCleanDescription(content);

    if (result && result.cleanDescription) {
      await prisma.job.update({
        where: { id: job.id },
        data: {
          cleanDescription: result.cleanDescription,
          summaryBullets: result.summaryBullets,
          requirementBullets: result.requirementBullets,
          benefitBullets: result.benefitBullets,
        },
      });
      updated++;
      console.log(`   ✅ Updated with clean description (${result.cleanDescription.length} chars)`);
    } else {
      failed++;
      console.log(`   ❌ Failed to generate clean description`);
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
