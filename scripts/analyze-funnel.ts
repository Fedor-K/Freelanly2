import { prisma } from '../src/lib/db';
import { getStripe } from '../src/lib/stripe';
import Stripe from 'stripe';

async function deepDive() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Who are the trial users?
  const stripe = getStripe();
  const trials = await stripe.subscriptions.list({ status: 'trialing', limit: 100, expand: ['data.customer'] });

  console.log('=== 8 TRIAL USERS (potential €120-150/mo) ===');
  for (const sub of trials.data) {
    const customer = sub.customer as Stripe.Customer;
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000) : new Date();
    const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000*60*60*24));
    console.log('  Email:', customer.email);
    console.log('  Trial ends:', trialEnd.toISOString().slice(0,10), '(' + daysLeft + ' days left)');
    console.log('');
  }

  // Recent apply attempts that didn't convert
  const recentAttempts = await prisma.applyAttempt.findMany({
    where: { createdAt: { gte: thirtyDaysAgo }, converted: false },
    include: { user: { select: { email: true, plan: true } }, job: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('=== RECENT PAYWALL HITS (not converted) ===');
  for (const attempt of recentAttempts) {
    console.log('  User:', attempt.user.email, '| Plan:', attempt.user.plan);
    console.log('  Job:', attempt.job.title);
    console.log('  Date:', attempt.createdAt.toISOString().slice(0,10));
    console.log('');
  }

  // PRO users - when did they convert?
  const proUsers = await prisma.user.findMany({
    where: { plan: 'PRO' },
    select: { email: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  console.log('=== RECENT PRO USERS ===');
  for (const user of proUsers) {
    console.log('  Email:', user.email);
    console.log('  Updated:', user.updatedAt.toISOString().slice(0,10));
    console.log('');
  }

  // Abandoned checkouts
  const abandoned = await prisma.abandonedCheckoutEmail.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  console.log('=== ABANDONED CHECKOUTS ===');
  for (const a of abandoned) {
    console.log('  Email:', a.user.email);
    console.log('  Price:', a.priceId);
    console.log('  Converted:', a.convertedAt ? 'YES' : 'NO');
    console.log('');
  }

  process.exit(0);
}

deepDive();
