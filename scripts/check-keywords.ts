import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const keywords = [
  "french translator",
  "chinese translator",
  "spanish translator",
  "spanish",
  "japanese translator",
  "looking for translator",
  "arabic translator",
  "portuguese translator",
  "italian translator",
  "turkish translator",
  "korean translator",
  "hindi translator",
  "polish translator",
  "dutch translator",
  "swedish translator",
  "norwegian translator",
  "danish translator",
  "finnish translator",
  "czech translator",
  "greek translator",
  "ukrainian translator",
  "english interpreter",
  "spanish interpreter",
  "looking for interpreter",
  "russian interpreter",
  "german interpreter",
  "french interpreter",
  "chinese interpreter",
  "japanese interpreter",
  "arabic interpreter",
  "portuguese interpreter",
  "italian interpreter",
  "turkish interpreter",
  "korean interpreter",
  "hindi interpreter",
  "polish interpreter",
  "dutch interpreter",
  "swedish interpreter",
  "norwegian interpreter",
  "danish interpreter",
  "finnish interpreter",
  "czech interpreter",
  "greek interpreter",
  "ukrainian interpreter",
  "editor",
  "proofreader",
  "linguist",
  "copywriter",
  "content writer",
  "content specialist",
  "content strategist",
  "localization specialist",
  "transcreator",
  "ux writer",
  "technical writer",
  "seo writer",
  "scriptwriter",
  "email marketing specialist",
  "qa tester",
  "mtpe",
  "subtitle creator",
];

async function main() {
  console.log('Searching for keywords in jobs...\n');

  const results: { keyword: string; count: number; examples: string[] }[] = [];

  for (const keyword of keywords) {
    const jobs = await prisma.job.findMany({
      where: {
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
          { originalContent: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      select: {
        title: true,
        company: { select: { name: true } },
      },
      take: 3,
    });

    results.push({
      keyword,
      count: jobs.length,
      examples: jobs.map(j => `${j.title} @ ${j.company.name}`),
    });
  }

  // Sort by count descending
  results.sort((a, b) => b.count - a.count);

  console.log('=== KEYWORDS WITH MATCHES ===\n');
  const withMatches = results.filter(r => r.count > 0);
  for (const r of withMatches) {
    console.log(`✅ "${r.keyword}" - ${r.count} job(s)`);
    for (const ex of r.examples) {
      console.log(`   → ${ex}`);
    }
  }

  console.log('\n=== KEYWORDS WITH NO MATCHES ===\n');
  const noMatches = results.filter(r => r.count === 0);
  for (const r of noMatches) {
    console.log(`❌ "${r.keyword}"`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`Keywords with matches: ${withMatches.length}`);
  console.log(`Keywords with NO matches: ${noMatches.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
