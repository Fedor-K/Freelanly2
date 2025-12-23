import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst({
    where: { slug: 'idt' },
  });
  console.log('=== IDT Company Data ===');
  console.log('Name:', company?.name);
  console.log('Slug:', company?.slug);
  console.log('Logo:', company?.logo);
  console.log('Website:', company?.website);
  console.log('Description:', company?.description || 'NULL');
  console.log('ATS Type:', company?.atsType);
  console.log('ATS ID:', company?.atsId);
  console.log('\nFull data:');
  console.log(JSON.stringify(company, null, 2));
}

main().finally(() => prisma.$disconnect());
