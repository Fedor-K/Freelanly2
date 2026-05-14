import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SettingsForm } from './SettingsForm';
import { CancelSubscriptionSection } from './CancelSubscriptionSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import './settings-design.css';

export const metadata: Metadata = {
  title: 'Settings — Freelanly',
};

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true, email: true, plan: true, createdAt: true,
      subscriptionEndsAt: true, stripeSubscriptionId: true,
      stripeId: true, paymentProvider: true, payproSubscriptionId: true,
    },
  });

  if (!user) redirect('/auth/signin');

  // Check if user has SMTP configured
  const smtp = await prisma.userSmtp.findFirst({
    where: { userId: session.user.id },
    select: { email: true },
  });

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Settings</h1>
          <p>Profile, sending rules, integrations, and account.</p>
        </div>
      </div>

      <div className="settings-grid">

        <aside className="card">
          <nav className="settings-nav">
            <a href="#profile" className="active">Profile &amp; identity</a>
            <a href="#rules">Sending rules</a>
            <a href="#integrations">Integrations</a>
            <a href="#notifications">Notifications</a>
            <a href="#account">Account</a>
            <a href="/dashboard/billing">Billing →</a>
          </nav>
        </aside>

        <div className="card">

          {/* Profile & identity */}
          <div className="settings-section" id="profile">
            <h2>Profile &amp; identity</h2>
            <div className="desc">This is what Freelanly uses to personalize every outreach. Keep it tight.</div>

            <SettingsForm initialData={{ name: user.name || '', email: user.email }} />

            <div className="field-row">
              <div className="lbl">Email<span className="sub">Used for login and notifications</span></div>
              <div className="ctrl"><input className="field" value={user.email} readOnly style={{opacity: 0.6}} /></div>
            </div>
            <div className="field-row">
              <div className="lbl">Plan</div>
              <div className="ctrl">
                <span style={{fontFamily: "'Geist Mono', monospace", fontSize: '13px', fontWeight: 500}}>{user.plan}</span>
                {user.plan === 'FREE' && <a href="/pricing" className="btn btn-acid btn-sm" style={{marginLeft: '10px'}}>Upgrade</a>}
              </div>
            </div>
            <div className="field-row">
              <div className="lbl">Member since</div>
              <div className="ctrl"><span className="meta f-mono">{new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></div>
            </div>
          </div>

          {/* Sending rules */}
          <div className="settings-section" id="rules">
            <h2>Sending rules</h2>
            <div className="desc">Set guardrails. Freelanly applies these to every queued send.</div>

            <div className="field-row">
              <div className="lbl">Send window<span className="sub">In your local timezone</span></div>
              <div className="ctrl">
                <input className="field" defaultValue="09:00" style={{maxWidth: '100px'}} />
                <span className="muted">→</span>
                <input className="field" defaultValue="17:00" style={{maxWidth: '100px'}} />
                <span className="meta f-mono">Mon–Fri only</span>
              </div>
            </div>
            <div className="field-row">
              <div className="lbl">Daily cap</div>
              <div className="ctrl"><input className="field" type="number" defaultValue="25" style={{maxWidth: '100px'}} /><span className="muted f-mono" style={{fontSize: '11px'}}>applications / day</span></div>
            </div>
            <div className="field-row">
              <div className="lbl">Follow-up cadence</div>
              <div className="ctrl">
                <select className="field" style={{maxWidth: '280px'}} defaultValue="3">
                  <option value="3">3 touches · day 0, +4, +8</option>
                  <option value="2">2 touches · day 0, +5</option>
                  <option value="1">1 touch · day 0 only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Integrations */}
          <div className="settings-section" id="integrations">
            <h2>Integrations</h2>
            <div className="desc">Where Freelanly reads opportunities and sends from.</div>

            <div className="integration">
              <div className="ico" style={{background: '#0A66C2', color: '#fff'}}>in</div>
              <div>
                <div className="name">LinkedIn</div>
                <div className="meta">Scanning hiring posts every 3 hours</div>
              </div>
              <span className="chip chip-good"><span className="chip-dot live"></span>Active</span>
            </div>
            {smtp ? (
              <div className="integration">
                <div className="ico" style={{background: '#EA4335', color: '#fff'}}>G</div>
                <div>
                  <div className="name">SMTP · {smtp.email}</div>
                  <div className="meta">Sending from this address via SMTP</div>
                </div>
                <span className="chip chip-good"><span className="chip-dot live"></span>Active</span>
              </div>
            ) : (
              <div className="integration">
                <div className="ico" style={{background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--line)'}}>✉</div>
                <div>
                  <div className="name">Email (SMTP)</div>
                  <div className="meta">Send applications from your own email address</div>
                </div>
                <a href="/dashboard/settings" className="btn btn-soft btn-sm">Connect</a>
              </div>
            )}
            <div className="integration">
              <div className="ico" style={{background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--line)'}}>▲</div>
              <div>
                <div className="name">Slack communities</div>
                <div className="meta">Bring your gig-channels into the feed</div>
              </div>
              <button className="btn btn-soft btn-sm">Connect</button>
            </div>
          </div>

          {/* Notifications */}
          <div className="settings-section" id="notifications">
            <h2>Notifications</h2>
            <div className="desc">When and how Freelanly pings you.</div>
            <div className="field-row">
              <div className="lbl">New reply</div>
              <div className="ctrl"><span className="toggle on"></span><span style={{fontSize: '13px'}}>Email notification</span></div>
            </div>
            <div className="field-row">
              <div className="lbl">Daily digest</div>
              <div className="ctrl"><span className="toggle on"></span><span style={{fontSize: '13px'}}>Email at 09:00</span></div>
            </div>
            <div className="field-row">
              <div className="lbl">Weekly insights</div>
              <div className="ctrl"><span className="toggle on"></span><span style={{fontSize: '13px'}}>Performance + template suggestions</span></div>
            </div>
          </div>

          {/* Account */}
          <div className="settings-section" id="account">
            <h2>Account</h2>
            <div className="desc">Subscription management and account deletion.</div>

            {user.stripeId && (
              <div className="field-row">
                <div className="lbl">Subscription<span className="sub">Update payment, view invoices</span></div>
                <div className="ctrl"><ManageSubscriptionButton /></div>
              </div>
            )}

            {user.plan === 'PRO' && (user.stripeSubscriptionId || user.paymentProvider === 'paypro') && (
              <CancelSubscriptionSection subscriptionEndsAt={user.subscriptionEndsAt} paymentProvider={user.paymentProvider || 'stripe'} />
            )}

            <DeleteAccountSection />
          </div>

        </div>
      </div>

    </div>
  );
}
