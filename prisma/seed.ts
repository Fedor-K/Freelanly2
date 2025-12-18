import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create categories
  const categories = [
    { slug: 'engineering', name: 'Engineering', icon: '💻', description: 'Software engineering, development, and technical roles' },
    { slug: 'frontend', name: 'Frontend', icon: '🎨', description: 'Frontend development, React, Vue, Angular jobs', parentSlug: 'engineering' },
    { slug: 'backend', name: 'Backend', icon: '⚙️', description: 'Backend development, APIs, databases', parentSlug: 'engineering' },
    { slug: 'fullstack', name: 'Full Stack', icon: '🔄', description: 'Full stack development roles', parentSlug: 'engineering' },
    { slug: 'mobile', name: 'Mobile', icon: '📱', description: 'iOS, Android, React Native, Flutter', parentSlug: 'engineering' },
    { slug: 'devops', name: 'DevOps', icon: '🔧', description: 'DevOps, SRE, infrastructure, cloud' },
    { slug: 'data', name: 'Data', icon: '📊', description: 'Data science, analytics, machine learning' },
    { slug: 'design', name: 'Design', icon: '🎨', description: 'UI/UX design, product design, graphic design' },
    { slug: 'product', name: 'Product', icon: '📦', description: 'Product management, product owner roles' },
    { slug: 'marketing', name: 'Marketing', icon: '📣', description: 'Digital marketing, growth, SEO, content' },
    { slug: 'sales', name: 'Sales', icon: '💼', description: 'Sales, business development, account management' },
    { slug: 'support', name: 'Support', icon: '🎧', description: 'Customer support, success, technical support' },
    { slug: 'hr', name: 'HR & People', icon: '👥', description: 'Human resources, recruiting, people operations' },
    { slug: 'finance', name: 'Finance', icon: '💰', description: 'Finance, accounting, financial analysis' },
  ];

  // Create parent categories first
  for (const cat of categories.filter(c => !c.parentSlug)) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, description: cat.description },
      create: { slug: cat.slug, name: cat.name, icon: cat.icon, description: cat.description },
    });
  }

  // Create child categories
  for (const cat of categories.filter(c => c.parentSlug)) {
    const parent = await prisma.category.findUnique({ where: { slug: cat.parentSlug } });
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, icon: cat.icon, description: cat.description, parentId: parent?.id },
      create: { slug: cat.slug, name: cat.name, icon: cat.icon, description: cat.description, parentId: parent?.id },
    });
  }

  console.log(`Created ${categories.length} categories`);

  // Create SEO landing pages
  const landingPages = [
    { slug: 'remote-react-jobs', categorySlug: 'frontend', title: 'Remote React Jobs', h1: 'Remote React Developer Jobs', metaDescription: 'Find remote React developer jobs. Apply to React positions at top companies hiring remotely.' },
    { slug: 'remote-senior-developer-jobs', level: 'SENIOR', title: 'Remote Senior Developer Jobs', h1: 'Remote Senior Developer Positions', metaDescription: 'Senior-level remote developer jobs. Find senior engineering positions at remote-first companies.' },
    { slug: 'remote-devops-jobs', categorySlug: 'devops', title: 'Remote DevOps Jobs', h1: 'Remote DevOps Engineer Jobs', metaDescription: 'Remote DevOps and SRE positions. AWS, Kubernetes, Terraform jobs at remote companies.' },
  ];

  for (const page of landingPages) {
    await prisma.landingPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: {
        slug: page.slug,
        categorySlug: page.categorySlug,
        level: page.level,
        title: page.title,
        h1: page.h1,
        metaDescription: page.metaDescription,
      },
    });
  }

  console.log(`Created ${landingPages.length} landing pages`);

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
