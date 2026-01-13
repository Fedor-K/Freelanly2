import { PrismaClient } from '@prisma/client';
import { calculateEstimatedSalary } from './salary-estimation';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Increase connection pool timeout
  // Note: For Neon, add ?connection_limit=10&pool_timeout=30 to DATABASE_URL

  // Middleware: Auto-add estimated salary if missing when creating jobs
  client.$use(async (params, next) => {
    if (params.model === 'Job' && params.action === 'create') {
      const data = params.args.data;

      // If no salary provided, calculate estimate
      if (data && data.salaryMin == null) {
        // Need to get category slug - it might be passed as categoryId
        let categorySlug: string | null = null;

        if (data.category?.connect?.slug) {
          categorySlug = data.category.connect.slug;
        } else if (data.categoryId) {
          // Lookup category slug by ID (sync lookup in middleware)
          try {
            const category = await client.category.findUnique({
              where: { id: data.categoryId },
              select: { slug: true },
            });
            categorySlug = category?.slug || null;
          } catch {
            categorySlug = 'support'; // fallback
          }
        }

        const estimated = calculateEstimatedSalary(
          categorySlug || 'support',
          data.level || 'MID',
          data.country || null
        );

        params.args.data = {
          ...data,
          salaryMin: estimated.salaryMin,
          salaryMax: estimated.salaryMax,
          salaryCurrency: estimated.salaryCurrency,
          salaryPeriod: estimated.salaryPeriod,
          salaryIsEstimate: true,
        };

        console.log(`[Prisma Middleware] Auto-added estimated salary for job: ${data.title}`);
      }
    }

    return next(params);
  });

  return client;
};

export const db = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

// Alias for convenience
export const prisma = db;
