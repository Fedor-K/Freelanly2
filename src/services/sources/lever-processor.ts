import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import type { ProcessingStats, LeverJob } from './types';

export async function processLeverSource(dataSourceId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get the data source
  const dataSource = await prisma.dataSource.findUnique({
    where: { id: dataSourceId },
  });

  if (!dataSource || dataSource.sourceType !== 'LEVER') {
    throw new Error('Invalid Lever data source');
  }

  if (!dataSource.companySlug) {
    throw new Error('Company slug is required for Lever source');
  }

  const apiUrl = dataSource.apiUrl ||
    `https://api.lever.co/v0/postings/${dataSource.companySlug}?mode=json`;

  try {
    console.log(`[Lever] Fetching jobs from: ${apiUrl}`);

    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Lever API error: ${response.status} ${response.statusText}`);
    }

    const jobs: LeverJob[] = await response.json();
    stats.total = jobs.length;
    console.log(`[Lever] Found ${jobs.length} jobs for ${dataSource.name}`);

    // Find or create company
    const company = await findOrCreateCompany(dataSource.name, dataSource.companySlug);

    // Process each job
    for (const job of jobs) {
      try {
        const result = await processLeverJob(job, company.id, dataSource.companySlug);
        if (result === 'created') stats.created++;
        else if (result === 'updated') stats.updated++;
        else if (result === 'skipped') stats.skipped++;
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Job ${job.id}: ${String(error)}`);
      }
    }

    // Update data source stats
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastSuccessAt: new Date(),
        totalImported: { increment: stats.created },
        lastError: null,
        errorCount: 0,
      },
    });

    return stats;
  } catch (error) {
    // Update data source with error
    await prisma.dataSource.update({
      where: { id: dataSourceId },
      data: {
        lastRunAt: new Date(),
        lastError: String(error),
        errorCount: { increment: 1 },
      },
    });

    throw error;
  }
}

async function processLeverJob(
  job: LeverJob,
  companyId: string,
  companySlug: string
): Promise<'created' | 'updated' | 'skipped'> {
  // Check if job already exists
  const existingJob = await prisma.job.findFirst({
    where: {
      OR: [
        { sourceId: job.id },
        { sourceUrl: job.hostedUrl },
      ],
    },
  });

  if (existingJob) {
    // Update if needed
    const needsUpdate = existingJob.title !== job.text ||
      existingJob.description !== (job.descriptionPlain || job.description);

    if (needsUpdate) {
      await prisma.job.update({
        where: { id: existingJob.id },
        data: {
          title: job.text,
          description: job.descriptionPlain || job.description || '',
          updatedAt: new Date(),
        },
      });
      return 'updated';
    }
    return 'skipped';
  }

  // Get category
  const categorySlug = mapDepartmentToCategory(job.categories.department);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });
  if (!category) {
    category = await prisma.category.create({
      data: { slug: categorySlug, name: getCategoryName(categorySlug) },
    });
  }

  // Generate slug
  const baseSlug = slugify(`${job.text}-${companySlug}`);
  const slug = await generateUniqueJobSlug(baseSlug);

  // Parse location
  const location = job.categories.location || 'Remote';
  const locationType = mapWorkplaceType(job.workplaceType, location);
  const country = extractCountryCode(location);

  // Parse level from title or department
  const level = extractLevel(job.text);

  // Parse job type
  const jobType = mapCommitmentToType(job.categories.commitment);

  // Build description
  const description = buildDescription(job);

  // Extract skills from tags/description
  const skills = extractSkillsFromDescription(description, job.categories.department);

  // Create job
  await prisma.job.create({
    data: {
      slug,
      title: job.text,
      description,
      companyId,
      categoryId: category.id,
      location,
      locationType,
      country,
      level,
      type: jobType,
      salaryMin: job.salaryRange?.min,
      salaryMax: job.salaryRange?.max,
      salaryCurrency: job.salaryRange?.currency || 'USD',
      salaryIsEstimate: false,
      skills,
      benefits: [],
      source: 'LEVER',
      sourceType: 'STRUCTURED',
      sourceUrl: job.hostedUrl,
      sourceId: job.id,
      applyUrl: job.applyUrl,
      enrichmentStatus: 'COMPLETED',
      qualityScore: 75, // ATS data is generally high quality
      postedAt: new Date(job.createdAt),
    },
  });

  return 'created';
}

async function findOrCreateCompany(name: string, slug: string) {
  let company = await prisma.company.findUnique({ where: { slug } });

  if (!company) {
    company = await prisma.company.create({
      data: {
        slug,
        name,
        atsType: 'LEVER',
        atsId: slug,
        verified: true,
      },
    });
  }

  return company;
}

async function generateUniqueJobSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;

  while (true) {
    const exists = await prisma.job.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }
}

function mapDepartmentToCategory(department?: string): string {
  if (!department) return 'engineering';

  const d = department.toLowerCase();
  if (d.includes('engineer') || d.includes('develop') || d.includes('software')) return 'engineering';
  if (d.includes('design') || d.includes('ux') || d.includes('ui')) return 'design';
  if (d.includes('product') && !d.includes('market')) return 'product';
  if (d.includes('market') || d.includes('growth')) return 'marketing';
  if (d.includes('sale') || d.includes('business dev')) return 'sales';
  if (d.includes('data') || d.includes('analytics') || d.includes('machine learning')) return 'data';
  if (d.includes('devops') || d.includes('infrastructure') || d.includes('sre') || d.includes('platform')) return 'devops';
  if (d.includes('support') || d.includes('customer')) return 'support';
  if (d.includes('hr') || d.includes('people') || d.includes('recruit') || d.includes('talent')) return 'hr';
  if (d.includes('finance') || d.includes('account') || d.includes('legal')) return 'finance';

  return 'engineering';
}

function getCategoryName(slug: string): string {
  const names: Record<string, string> = {
    engineering: 'Engineering',
    design: 'Design',
    product: 'Product',
    marketing: 'Marketing',
    sales: 'Sales',
    data: 'Data',
    devops: 'DevOps',
    support: 'Support',
    hr: 'HR',
    finance: 'Finance',
  };
  return names[slug] || slug;
}

function mapWorkplaceType(workplaceType?: string, location?: string): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  if (workplaceType === 'remote') {
    const loc = location?.toLowerCase() || '';
    if (loc.includes('us') || loc.includes('united states') || loc.includes('usa')) return 'REMOTE_US';
    if (loc.includes('eu') || loc.includes('europe') || loc.includes('emea')) return 'REMOTE_EU';
    return 'REMOTE';
  }
  if (workplaceType === 'hybrid') return 'HYBRID';
  return 'ONSITE';
}

function extractCountryCode(location: string): string | null {
  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US', 'america': 'US',
    'uk': 'GB', 'united kingdom': 'GB', 'britain': 'GB', 'england': 'GB',
    'canada': 'CA',
    'germany': 'DE',
    'france': 'FR',
    'netherlands': 'NL',
    'spain': 'ES',
    'italy': 'IT',
    'australia': 'AU',
    'india': 'IN',
    'brazil': 'BR',
    'mexico': 'MX',
    'poland': 'PL',
    'portugal': 'PT',
    'ireland': 'IE',
    'sweden': 'SE',
    'switzerland': 'CH',
    'singapore': 'SG',
    'japan': 'JP',
    'israel': 'IL',
  };

  const loc = location.toLowerCase();
  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) return code;
  }
  return null;
}

function extractLevel(title: string): 'INTERN' | 'ENTRY' | 'JUNIOR' | 'MID' | 'SENIOR' | 'LEAD' | 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE' {
  const t = title.toLowerCase();
  if (t.includes('intern')) return 'INTERN';
  if (t.includes('entry') || t.includes('graduate') || t.includes('new grad')) return 'ENTRY';
  if (t.includes('junior') || t.includes('jr.') || t.includes('jr ')) return 'JUNIOR';
  if (t.includes('senior') || t.includes('sr.') || t.includes('sr ')) return 'SENIOR';
  if (t.includes('staff') || t.includes('principal')) return 'LEAD';
  if (t.includes('lead') || t.includes('tech lead')) return 'LEAD';
  if (t.includes('manager') && !t.includes('product manager')) return 'MANAGER';
  if (t.includes('director')) return 'DIRECTOR';
  if (t.includes('vp') || t.includes('vice president') || t.includes('head of') || t.includes('chief')) return 'EXECUTIVE';
  return 'MID';
}

function mapCommitmentToType(commitment?: string): 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'FREELANCE' | 'INTERNSHIP' | 'TEMPORARY' {
  if (!commitment) return 'FULL_TIME';
  const c = commitment.toLowerCase();
  if (c.includes('part-time') || c.includes('part time')) return 'PART_TIME';
  if (c.includes('contract') || c.includes('contractor')) return 'CONTRACT';
  if (c.includes('freelance')) return 'FREELANCE';
  if (c.includes('intern')) return 'INTERNSHIP';
  if (c.includes('temporary') || c.includes('temp')) return 'TEMPORARY';
  return 'FULL_TIME';
}

function buildDescription(job: LeverJob): string {
  let description = job.descriptionPlain || job.description || '';

  if (job.lists && job.lists.length > 0) {
    for (const list of job.lists) {
      description += `\n\n${list.text}\n${list.content}`;
    }
  }

  if (job.additionalPlain || job.additional) {
    description += `\n\n${job.additionalPlain || job.additional}`;
  }

  return description.trim();
}

function extractSkillsFromDescription(description: string, department?: string): string[] {
  const skills: Set<string> = new Set();

  // Common tech skills to look for
  const techSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Golang', 'Rust', 'C++', 'C#',
    'React', 'Angular', 'Vue', 'Node.js', 'Next.js', 'Django', 'Rails', 'Spring',
    'AWS', 'GCP', 'Azure', 'Kubernetes', 'Docker', 'Terraform',
    'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch',
    'GraphQL', 'REST', 'API', 'Microservices',
    'Machine Learning', 'AI', 'Data Science', 'TensorFlow', 'PyTorch',
    'Figma', 'Sketch', 'Adobe XD',
    'Agile', 'Scrum', 'CI/CD', 'Git',
  ];

  const lowerDesc = description.toLowerCase();
  for (const skill of techSkills) {
    if (lowerDesc.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  }

  // Add department-based skills
  if (department) {
    const d = department.toLowerCase();
    if (d.includes('frontend')) skills.add('Frontend');
    if (d.includes('backend')) skills.add('Backend');
    if (d.includes('fullstack') || d.includes('full-stack')) skills.add('Full Stack');
    if (d.includes('mobile')) skills.add('Mobile');
    if (d.includes('devops') || d.includes('infrastructure')) skills.add('DevOps');
    if (d.includes('data')) skills.add('Data');
  }

  return Array.from(skills).slice(0, 10); // Max 10 skills
}
