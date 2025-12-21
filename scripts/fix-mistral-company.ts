/**
 * Fix Mistral company data - replace biscuiterie with Mistral AI
 */

import { prisma } from '../src/lib/db';

async function main() {
  console.log('Finding biscuiterie-mistral company...');

  const company = await prisma.company.findFirst({
    where: { slug: 'biscuiterie-mistral' }
  });

  if (!company) {
    console.log('Company not found with slug "biscuiterie-mistral"');

    // Try to find by name containing mistral
    const mistralCompanies = await prisma.company.findMany({
      where: { name: { contains: 'mistral', mode: 'insensitive' } },
      select: { id: true, name: true, slug: true, website: true }
    });

    console.log('Companies with "mistral" in name:', mistralCompanies);
    return;
  }

  console.log('Current company data:', JSON.stringify(company, null, 2));

  // Update with correct Mistral AI data
  const updated = await prisma.company.update({
    where: { id: company.id },
    data: {
      name: 'Mistral AI',
      slug: 'mistral-ai',
      description: 'Mistral AI is a French artificial intelligence company that develops open-source large language models. Founded in 2023 by former Google DeepMind and Meta researchers, Mistral AI builds frontier AI models with a focus on efficiency and openness.',
      website: 'https://mistral.ai',
      logo: 'https://mistral.ai/images/logo.svg',
      industry: 'Artificial Intelligence',
      size: 'MEDIUM',
      headquarters: 'Paris, France',
      linkedinUrl: 'https://www.linkedin.com/company/mistral-ai/',
    }
  });

  console.log('Updated company:', JSON.stringify(updated, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
