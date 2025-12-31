import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function enrichCompany(slug: string) {
  const company = await prisma.company.findFirst({
    where: { slug }
  });

  if (company === null) {
    console.log('Company not found');
    return;
  }

  const domain = company.website ? new URL(company.website).hostname.replace('www.', '') : null;
  console.log('Domain:', domain);

  if (domain === null) {
    console.log('No domain to enrich');
    return;
  }

  const res = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.APOLLO_API_KEY1 || ''
    },
    body: JSON.stringify({ domain })
  });

  const data = await res.json();

  if (data.organization === undefined || data.organization === null) {
    console.log('Apollo: No data found');
    await prisma.company.update({
      where: { id: company.id },
      data: { apolloEnrichedAt: new Date() }
    });
    return;
  }

  const org = data.organization;
  console.log('Apollo found:', org.name);
  console.log('Description:', org.short_description ? org.short_description.slice(0, 100) : 'none');
  console.log('Logo:', org.logo_url);

  await prisma.company.update({
    where: { id: company.id },
    data: {
      name: org.name || company.name,
      description: org.short_description || null,
      logo: org.logo_url || null,
      industry: org.industry || null,
      foundedYear: org.founded_year || null,
      headquarters: org.city && org.country ? `${org.city}, ${org.country}` : null,
      linkedinUrl: org.linkedin_url || null,
      apolloEnrichedAt: new Date()
    }
  });

  console.log('\nUpdated company successfully!');
}

const slug = process.argv[2] || 'wr';
enrichCompany(slug);
