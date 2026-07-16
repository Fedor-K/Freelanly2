import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { QueueUpgradeButton } from '@/components/app/QueueUpgradeButton';
import './billing-design.css';

export const metadata: Metadata = {
  title: 'Billing — Freelanly',
};

export const revalidate = 60;

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true, email: true, plan: true,
      stripeId: true, stripeSubscriptionId: true,
      subscriptionEndsAt: true, paymentProvider: true,
      createdAt: true,
    },
  });

  if (!user) redirect('/auth/signin');

  // Usage stats
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [sentThisMonth, templateCount, smtpCount] = await Promise.all([
    prisma.autoApplication.count({
      where: { userId, sentAt: { gte: monthStart }, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] } },
    }),
    prisma.coverLetterTemplate.count({ where: { userId } }),
    prisma.userSmtp.count({ where: { userId } }),
  ]);

  const isPro = user.plan === 'PRO';
  const appLimit = 600; // 20/day × 30 — the real enforced cap, same for every plan
  const usagePct = Math.min((sentThisMonth / appLimit) * 100, 100);

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Billing &amp; usage</h1>
          <p>Your plan, usage this cycle, payment method, and invoice history.</p>
        </div>
        <div className="page-actions">
          {user.stripeId && (
            <form action="/api/stripe/portal" method="POST">
              <button type="submit" className="btn btn-ghost">Manage subscription</button>
            </form>
          )}
        </div>
      </div>

      {/* Current usage */}
      <div className="grid grid-3 mb-4">
        <div className="card card-pad">
          <div className="eyebrow mb-2">Applications this cycle</div>
          <div className="row between mb-2">
            <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '22px', fontWeight: 600}}>{sentThisMonth}</span>
            <span className="meta">/ 600 (20/day)</span>
          </div>
          <div className={`usage-bar${usagePct > 80 ? ' warn' : ''}`}><div className="fill" style={{width: `${usagePct}%`}}></div></div>
          <div className="meta mt-2">Resets in {daysLeft} days · {nextReset.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow mb-2">Inboxes</div>
          <div className="row between mb-2">
            <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '22px', fontWeight: 600}}>{smtpCount}</span>
            <span className="meta">connected</span>
          </div>
          <div className="usage-bar"><div className="fill" style={{width: `${Math.min(smtpCount * 100, 100)}%`}}></div></div>
          <div className="meta mt-2">{user.email}</div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow mb-2">Templates</div>
          <div className="row between mb-2">
            <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '22px', fontWeight: 600}}>{templateCount}</span>
            <span className="meta">saved</span>
          </div>
          <div className="usage-bar"><div className="fill" style={{width: '100%'}}></div></div>
          <div className="meta mt-2"><a href="/dashboard/templates" style={{color: 'var(--acid-deep)'}}>Manage templates →</a></div>
        </div>
      </div>

      {/* Plan */}
      <div className="card mb-4">
        <div className="card-head">
          <div>
            <h3>Your plan</h3>
            <div className="meta mt-1">
              {user.subscriptionEndsAt
                ? `Renews ${new Date(user.subscriptionEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : user.plan === 'FREE' ? 'Free forever' : 'Active subscription'
              }
            </div>
          </div>
          <div className="row gap-2">
            <a href="/pricing" className="btn btn-ghost btn-sm">Compare plans</a>
          </div>
        </div>
        <div style={{padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px'}}>

          <div className={`plan-card${user.plan === 'FREE' ? ' current' : ''}`}>
            <div className="badge" style={user.plan === 'FREE' ? {} : {color: 'var(--ink-4)'}}>
              {user.plan === 'FREE' ? '★ Current plan' : '— Free'}
            </div>
            <div className="name">Free</div>
            <div className="price">$0<span className="unit">/mo</span></div>
            <div className="desc">20 applications/day · AI cover letters with reviewer pass · Send from your own Gmail</div>
            {user.plan !== 'FREE' && user.stripeId && (
              <form action="/api/stripe/portal" method="POST">
                <button type="submit" className="btn btn-soft btn-sm mt-3" style={{width: '100%'}}>Downgrade</button>
              </form>
            )}
          </div>

          <div className={`plan-card${user.plan === 'PRO' ? ' current' : ''}`}>
            <div className="badge">
              {user.plan === 'PRO' ? '★ Current plan' : '↑ Upgrade'}
            </div>
            <div className="name">Pro</div>
            <div className="price">$5<span className="unit">/mo</span></div>
            <div className="desc">Morning ready-queue — applications pre-written for your top matches · your CV attached to every send</div>
            {user.plan === 'PRO' ? (
              <div className="row gap-2 mt-3">
                {user.stripeId && (
                  <form action="/api/stripe/portal" method="POST" style={{flex: 1}}>
                    <button type="submit" className="btn btn-ghost btn-sm" style={{width: '100%'}}>Manage</button>
                  </form>
                )}
              </div>
            ) : (
              <div className="mt-3"><QueueUpgradeButton source="billing" label="Upgrade to Pro →" /></div>
            )}
          </div>


        </div>
      </div>

      {/* Account info */}
      <div className="card">
        <div className="card-head"><h3>Account</h3></div>
        <div style={{padding: '16px 24px'}}>
          <div className="row between" style={{padding: '10px 0', borderBottom: '1px solid var(--line)'}}>
            <div style={{fontSize: '13px', color: 'var(--ink-3)'}}>Email</div>
            <div style={{fontSize: '13px', fontWeight: 500}}>{user.email}</div>
          </div>
          <div className="row between" style={{padding: '10px 0', borderBottom: '1px solid var(--line)'}}>
            <div style={{fontSize: '13px', color: 'var(--ink-3)'}}>Plan</div>
            <div style={{fontSize: '13px', fontWeight: 500}}>{user.plan}</div>
          </div>
          <div className="row between" style={{padding: '10px 0'}}>
            <div style={{fontSize: '13px', color: 'var(--ink-3)'}}>Member since</div>
            <div style={{fontSize: '13px', fontWeight: 500}}>{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
