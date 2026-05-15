import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SettingsForm } from './SettingsForm';
import { CancelSubscriptionSection } from './CancelSubscriptionSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { SendingRules, NotificationToggles } from '@/components/app/SettingsToggles';
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
      resumeText: true, parsedProfile: true,
      resumeUrl: true, resumeFileName: true,
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

            {/* Parsed profile from resume */}
            {(() => {
              const profile = user.parsedProfile as Record<string, unknown> | null;
              const skills = (profile?.skills as string[]) || [];
              const languages = (profile?.languages as string[]) || [];
              const experience = (user.resumeText || '').slice(0, 200);
              return (
                <>
                  <div className="field-row">
                    <div className="lbl">Skills<span className="sub">Extracted from your resume</span></div>
                    <div className="ctrl" style={{flexWrap: 'wrap', gap: '4px'}}>
                      {skills.length > 0 ? skills.map(s => (
                        <span key={s} className="tag tag-acid">{s}</span>
                      )) : <span className="meta">No skills detected — upload a resume</span>}
                    </div>
                  </div>
                  {languages.length > 0 && (
                    <div className="field-row">
                      <div className="lbl">Languages</div>
                      <div className="ctrl" style={{flexWrap: 'wrap', gap: '4px'}}>
                        {languages.map(l => <span key={l} className="tag">{l}</span>)}
                      </div>
                    </div>
                  )}
                  <div className="field-row">
                    <div className="lbl">Resume preview<span className="sub">How the system sees you</span></div>
                    <div className="ctrl">
                      {experience ? (
                        <div style={{fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.5, maxWidth: '400px'}}>
                          {experience}{user.resumeText && user.resumeText.length > 200 ? '...' : ''}
                        </div>
                      ) : (
                        <span className="meta">No resume uploaded</span>
                      )}
                    </div>
                  </div>
                  {user.resumeUrl && (
                    <div className="field-row">
                      <div className="lbl">Resume file<span className="sub">Your uploaded document</span></div>
                      <div className="ctrl">
                        <a href={user.resumeUrl} target="_blank" rel="noopener" className="btn btn-soft btn-sm" style={{display: 'inline-flex', alignItems: 'center', gap: '6px'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                          {user.resumeFileName || 'Download resume'}
                        </a>
                      </div>
                    </div>
                  )}
                  <div className="field-row">
                    <div className="lbl">Update resume</div>
                    <div className="ctrl">
                      <a href="/onboarding" className="btn btn-soft btn-sm">Upload new resume</a>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>

          {/* Sending rules */}
          <div className="settings-section" id="rules">
            <h2>Sending rules</h2>
            <div className="desc">Set guardrails. Freelanly applies these to every queued send.</div>

            <SendingRules />
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
              <span className="meta" style={{fontSize: '11px'}}>Coming soon</span>
            </div>
          </div>

          {/* Notifications */}
          <div className="settings-section" id="notifications">
            <h2>Notifications</h2>
            <div className="desc">When and how Freelanly pings you.</div>
            <NotificationToggles />
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
