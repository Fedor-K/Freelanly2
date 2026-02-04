/**
 * Backfill Script: Generate Z.ai descriptions for companies without descriptions
 *
 * Finds all companies with description=null and generates descriptions via Z.ai.
 * Processes in batches with rate limiting.
 *
 * Run with: npx tsx scripts/backfill-company-descriptions.ts
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const BATCH_SIZE = 20;
const DELAY_MS = 300; // delay between Z.ai calls

const zaiClient = new OpenAI({
  apiKey: process.env.ZAI_API_KEY || '',
  baseURL: 'https://api.z.ai/api/paas/v4',
});

const DESCRIPTION_PROMPT = `Generate a detailed company description (2-3 paragraphs, 800-1200 characters) based on the company name and website domain.

Structure:
1. First paragraph: Company overview - what they do, industry, when/where founded if inferable from name
2. Second paragraph: Main products/services, key features, target audience
3. Third paragraph (optional): Notable achievements, market position, or unique value proposition

Style guidelines:
- Professional, informative tone
- Use specific details where possible
- Avoid generic marketing phrases
- Write in third person

Return ONLY the description text, no headers or formatting.`;

function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function deriveDomainFromName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[,.]?\s*(inc|llc|ltd|corp|corporation|company|co|gmbh|ag|sa|srl|limited)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  return `${cleaned}.com`;
}

async function generateDescription(name: string, domain: string): Promise<string | null> {
  try {
    const response = await zaiClient.chat.completions.create({
      model: 'glm-4-32b-0414-128k',
      messages: [
        { role: 'system', content: DESCRIPTION_PROMPT },
        { role: 'user', content: `Company: ${name}\nWebsite: ${domain}` },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const description = response.choices[0]?.message?.content?.trim();
    if (description && description.length > 50) {
      return description;
    }
    return null;
  } catch (error) {
    console.error(`  Error generating for ${name}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

async function backfillDescriptions() {
  if (!process.env.ZAI_API_KEY) {
    console.error('ZAI_API_KEY is not set. Exiting.');
    process.exit(1);
  }

  const totalWithout = await prisma.company.count({ where: { description: null } });
  const totalWith = await prisma.company.count({ where: { description: { not: null } } });
  const total = totalWithout + totalWith;

  console.log(`Companies total: ${total}`);
  console.log(`  With description: ${totalWith}`);
  console.log(`  Without description: ${totalWithout}\n`);

  if (totalWithout === 0) {
    console.log('All companies already have descriptions. Nothing to do.');
    return;
  }

  let processed = 0;
  let enriched = 0;
  let failed = 0;

  while (true) {
    const companies = await prisma.company.findMany({
      where: { description: null },
      select: { id: true, name: true, website: true },
      take: BATCH_SIZE,
    });

    if (companies.length === 0) break;

    console.log(`\nBatch: ${companies.length} companies (${processed}/${totalWithout} done)`);

    for (const company of companies) {
      processed++;
      const domain = extractDomainFromUrl(company.website) || deriveDomainFromName(company.name);

      process.stdout.write(`  [${processed}/${totalWithout}] ${company.name} (${domain})... `);

      const description = await generateDescription(company.name, domain);

      if (description) {
        await prisma.company.update({
          where: { id: company.id },
          data: { description, apolloEnrichedAt: new Date() },
        });
        enriched++;
        console.log(`OK (${description.length} chars)`);
      } else {
        // Mark as tried so we don't retry endlessly
        await prisma.company.update({
          where: { id: company.id },
          data: { apolloEnrichedAt: new Date(), description: '' },
        });
        failed++;
        console.log('FAILED');
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`\n--- Done ---`);
  console.log(`Processed: ${processed}`);
  console.log(`Enriched: ${enriched}`);
  console.log(`Failed: ${failed}`);
}

backfillDescriptions()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
