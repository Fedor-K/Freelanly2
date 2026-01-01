/**
 * Generate company descriptions using Z.ai
 * For companies that Apollo didn't have data for
 */

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

const zai = new OpenAI({
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

Return ONLY the description text, no headers or formatting.

Example:
"Stripe is a financial technology company founded in 2010 and headquartered in San Francisco, California. The company specializes in payment processing software and APIs that enable businesses of all sizes to accept online payments securely and efficiently.

Stripe offers a comprehensive suite of products including payment processing, billing and invoicing, fraud prevention, and financial reporting tools. Their platform supports over 135 currencies and various payment methods, serving millions of businesses worldwide from startups to Fortune 500 companies.

The company has become one of the most valuable fintech startups globally, known for its developer-friendly approach and continuous innovation in the payments infrastructure space."`;

async function generateDescription(name: string, website: string): Promise<string> {
  const domain = website.replace(/^https?:\/\//, '').replace(/\/$/, '');

  const response = await zai.chat.completions.create({
    model: 'glm-4-32b-0414-128k',
    messages: [
      { role: 'system', content: DESCRIPTION_PROMPT },
      { role: 'user', content: `Company: ${name}\nWebsite: ${domain}` }
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content?.trim() || '';
}

async function main() {
  const limit = parseInt(process.argv[2]) || 102;

  console.log('🏢 Generating company descriptions with Z.ai\n');
  console.log('='.repeat(60));

  if (!process.env.ZAI_API_KEY) {
    console.error('❌ ZAI_API_KEY not set');
    process.exit(1);
  }

  // Get companies without description OR with short descriptions (< 200 chars)
  const companies = await prisma.company.findMany({
    where: {
      website: { not: null },
      OR: [
        { description: null },
        { description: { not: null } }  // Will filter by length in code
      ]
    },
    select: { id: true, name: true, website: true, slug: true, description: true },
    take: limit * 2,
  });

  // Filter to only include null or short descriptions
  const toProcess = companies
    .filter(c => !c.description || c.description.length < 200)
    .slice(0, limit);

  console.log(`\nFound ${companies.length} companies, ${toProcess.length} need descriptions...\n`);

  let success = 0;
  let failed = 0;
  const startTime = Date.now();

  for (const company of toProcess) {
    try {
      const description = await generateDescription(company.name, company.website!);

      if (description && description.length > 10) {
        await prisma.company.update({
          where: { id: company.id },
          data: { description }
        });

        console.log(`✅ ${company.name}`);
        console.log(`   ${description.substring(0, 80)}${description.length > 80 ? '...' : ''}\n`);
        success++;
      } else {
        console.log(`⚠️  ${company.name} - empty response\n`);
        failed++;
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`❌ ${company.name}:`, error);
      failed++;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  console.log('='.repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total: ${toProcess.length}`);
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);
  console.log(`Time: ${elapsed.toFixed(1)}s`);
  if (toProcess.length > 0) {
    console.log(`Avg: ${(elapsed / toProcess.length).toFixed(2)}s per company`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
