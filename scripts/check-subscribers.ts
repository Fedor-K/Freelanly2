import { prisma } from '../src/lib/db';

async function main() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // NEW SUBSCRIPTIONS
  console.log('========== NEW SUBSCRIPTIONS TODAY ==========\n');
  
  const newSubs = await prisma.revenueEvent.findMany({
    where: {
      createdAt: { gte: today },
      type: 'SUBSCRIPTION_STARTED'
    },
    orderBy: { createdAt: 'desc' }
  });
  
  for (const event of newSubs) {
    if (!event.userId) continue;
    
    const user = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { email: true, name: true, createdAt: true }
    });
    
    console.log('=== ' + (user?.email || 'Unknown') + ' ===');
    console.log('Subscribed at:', event.createdAt.toISOString());
    
    // Check job alerts
    const alerts = await prisma.jobAlert.findMany({
      where: { userId: event.userId }
    });
    console.log('Alerts:', alerts.map(a => a.category || 'all').join(', '));
    
    // Check applications
    const applications = await prisma.application.findMany({
      where: { userId: event.userId },
      take: 5,
      include: { job: { select: { title: true, company: { select: { name: true } } } } }
    });
    if (applications.length > 0) {
      console.log('Applications:');
      applications.forEach(a => console.log('  -', a.job.title, '(' + a.job.company.name + ')'));
    } else {
      console.log('Applications: none yet');
    }
    
    console.log('');
  }
  
  // CHURNED SUBSCRIPTIONS
  console.log('========== CHURNED TODAY ==========\n');
  
  const churned = await prisma.revenueEvent.findMany({
    where: {
      createdAt: { gte: today },
      type: 'SUBSCRIPTION_CHURNED'
    },
    orderBy: { createdAt: 'desc' }
  });
  
  for (const event of churned) {
    let user = null;
    
    if (event.userId) {
      user = await prisma.user.findUnique({
        where: { id: event.userId },
        select: { id: true, email: true, name: true, createdAt: true, plan: true }
      });
    } else if (event.stripeCustomerId) {
      user = await prisma.user.findFirst({
        where: { stripeId: event.stripeCustomerId },
        select: { id: true, email: true, name: true, createdAt: true, plan: true }
      });
    }
    
    console.log('=== ' + (user?.email || event.stripeCustomerId || 'Unknown') + ' ===');
    console.log('Churned at:', event.createdAt.toISOString());
    if (user) {
      console.log('Account created:', user.createdAt?.toISOString());
      console.log('Current plan:', user.plan);
      
      // What did they apply to?
      const applications = await prisma.application.findMany({
        where: { userId: user.id },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { job: { select: { title: true, company: { select: { name: true } } } } }
      });
      if (applications.length > 0) {
        console.log('Their applications (' + applications.length + '):');
        applications.forEach(a => console.log('  -', a.job.title, '(' + a.job.company.name + ')'));
      } else {
        console.log('Applications: none');
      }
      
      // Alerts
      const alerts = await prisma.jobAlert.findMany({
        where: { userId: user.id }
      });
      if (alerts.length > 0) {
        console.log('Alerts:', alerts.map(a => a.category || 'all').join(', '));
      }
    }
    
    console.log('');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
