import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create categories (synced with src/config/site.ts)
  const categories = [
    // Tech
    { slug: 'engineering', name: 'Engineering', icon: '💻', description: 'Software engineering, development, and technical roles' },
    { slug: 'frontend', name: 'Frontend', icon: '🎨', description: 'Frontend development, React, Vue, Angular jobs', parentSlug: 'engineering' },
    { slug: 'backend', name: 'Backend', icon: '⚙️', description: 'Backend development, APIs, databases', parentSlug: 'engineering' },
    { slug: 'fullstack', name: 'Full Stack', icon: '🔄', description: 'Full stack development roles', parentSlug: 'engineering' },
    { slug: 'mobile', name: 'Mobile', icon: '📱', description: 'iOS, Android, React Native, Flutter', parentSlug: 'engineering' },
    { slug: 'design', name: 'Design', icon: '🎨', description: 'UI/UX design, product design, graphic design' },
    { slug: 'data', name: 'Data & Analytics', icon: '📊', description: 'Data science, analytics, machine learning, BI' },
    { slug: 'devops', name: 'DevOps', icon: '🔧', description: 'DevOps, SRE, infrastructure, cloud engineering' },
    { slug: 'qa', name: 'QA & Testing', icon: '🧪', description: 'Quality assurance, testing, automation' },
    { slug: 'security', name: 'Security', icon: '🔒', description: 'Information security, cybersecurity, compliance' },
    // Business
    { slug: 'product', name: 'Product', icon: '📦', description: 'Product management, product owner roles' },
    { slug: 'marketing', name: 'Marketing', icon: '📣', description: 'Digital marketing, growth, SEO, content marketing' },
    { slug: 'sales', name: 'Sales', icon: '💼', description: 'Sales, business development, account management' },
    { slug: 'finance', name: 'Finance', icon: '💰', description: 'Finance, accounting, payroll, financial analysis' },
    { slug: 'hr', name: 'HR & Recruiting', icon: '👥', description: 'Human resources, recruiting, people operations' },
    { slug: 'operations', name: 'Operations', icon: '⚙️', description: 'Operations, administration, office management' },
    { slug: 'legal', name: 'Legal', icon: '⚖️', description: 'Legal, compliance, contracts, intellectual property' },
    { slug: 'project-management', name: 'Project Management', icon: '📋', description: 'Project management, scrum master, agile coach' },
    // Content & Creative
    { slug: 'writing', name: 'Writing & Content', icon: '✍️', description: 'Copywriting, content creation, technical writing' },
    { slug: 'translation', name: 'Translation', icon: '🌐', description: 'Translation, localization, interpretation' },
    { slug: 'creative', name: 'Creative & Media', icon: '🎬', description: 'Video production, animation, photography, media' },
    // Other
    { slug: 'support', name: 'Customer Support', icon: '🎧', description: 'Customer support, success, technical support' },
    { slug: 'education', name: 'Education', icon: '📚', description: 'Training, teaching, instructional design, e-learning' },
    { slug: 'research', name: 'Research', icon: '🔬', description: 'User research, market research, academic research' },
    { slug: 'consulting', name: 'Consulting', icon: '💡', description: 'Consulting, advisory, strategy' },
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
