import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'Pricing — Freelanly · from $0/mo · cancel anytime',
  description: 'Start free. Upgrade when your inbox starts filling up. Cancel any time.',
  alternates: { canonical: `${siteConfig.url}/pricing` },
};

const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
const Cross = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export default function PricingPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      {/* Header */}
      <header className="pt-28 pb-12 text-center relative overflow-hidden">
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(199,249,74,0.14), transparent 70%)' }} />
        <div className="max-w-[1240px] mx-auto px-8 relative z-10">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Pricing</span>
          <h1 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4">Pay less than <span className="text-[#C7F94A]">one billable hour</span>.<br/>Apply to a thousand gigs.</h1>
          <p className="text-[19px] text-[#D4D4D8] mt-4 max-w-[50ch] mx-auto leading-relaxed">Start free. Upgrade when your inbox starts filling up. Cancel any time — your data goes with you.</p>
        </div>
      </header>

      {/* Plans */}
      <section className="pb-16">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-5 items-start">
            {/* FREE */}
            <div className="rounded-2xl p-7" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[15px] font-semibold mb-2">Free</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">For testing the waters. See what Freelanly catches before you commit.</p>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-[13px] text-[#A1A1AA]">$</span><span className="text-[48px] font-semibold tracking-tighter leading-none">0</span></div>
              <div className="text-[13px] text-[#6B7280] mb-6">forever, on us</div>
              <Link href="/auth/signin" className="block w-full text-center py-3 rounded-full text-[14px] font-medium border mb-7" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Start free</Link>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6B7280] mb-3">What&apos;s included</div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>10</strong> AI applications / month</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Browse all live gigs</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Basic AI cover letter</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Manual send</li>
                <li className="flex items-center gap-2.5 text-[#6B7280]"><Cross /> Auto-apply</li>
                <li className="flex items-center gap-2.5 text-[#6B7280]"><Cross /> Follow-ups</li>
              </ul>
            </div>

            {/* PRO */}
            <div className="rounded-2xl p-7 relative" style={{ background: '#0E1016', border: '2px solid #C7F94A', boxShadow: '0 0 60px -20px rgba(199,249,74,0.18)' }}>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#000' }}>Most popular</span>
              <div className="text-[15px] font-semibold mb-2 text-[#C7F94A]">Pro</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">For full-time freelancers. Auto-apply + AI cover letters + follow-ups, on autopilot.</p>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-[13px] text-[#A1A1AA]">$</span><span className="text-[48px] font-semibold tracking-tighter leading-none">29</span><span className="text-[15px] text-[#A1A1AA] ml-1">/ month</span></div>
              <div className="text-[13px] text-[#6B7280] mb-6">billed monthly</div>
              <Link href="/auth/signin" className="block w-full text-center py-3 rounded-full text-[14px] font-semibold mb-7" style={{ background: '#C7F94A', color: '#000' }}>Start 7-day free trial →</Link>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6B7280] mb-3">Everything in Free, plus</div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>500</strong> AI applications / month</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>Auto-apply</strong> with smart filters</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>Auto follow-ups</strong> after 5 days</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Premium AI model (GPT-class)</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Tracking &amp; reply analytics</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Send from your own inbox</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Early access to new jobs (3hr edge)</li>
              </ul>
            </div>

            {/* AGENCY */}
            <div className="rounded-2xl p-7" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[15px] font-semibold mb-2">Agency</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">For studios &amp; small teams running outreach for multiple freelancers.</p>
              <div className="flex items-baseline gap-1 mb-1"><span className="text-[13px] text-[#A1A1AA]">$</span><span className="text-[48px] font-semibold tracking-tighter leading-none">89</span><span className="text-[15px] text-[#A1A1AA] ml-1">/ month</span></div>
              <div className="text-[13px] text-[#6B7280] mb-6">up to 5 seats</div>
              <a href="mailto:hi@freelanly.com" className="block w-full text-center py-3 rounded-full text-[14px] font-medium border mb-7" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Talk to us</a>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6B7280] mb-3">Everything in Pro, plus</div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>Unlimited</strong> applications</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>5 seats</strong> ($15 / extra seat)</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Shared template library</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Team analytics &amp; pipeline view</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Priority support (4hr SLA)</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Custom AI training on your style</li>
              </ul>
            </div>
          </div>
          <p className="text-center text-[14px] text-[#6B7280] mt-7">All plans include unlimited browsing · No credit card to start · Cancel any time</p>
        </div>
      </section>

      {/* ROI */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1000px] mx-auto px-8 grid md:grid-cols-[1fr_1px_1fr] gap-12 items-center">
          <div>
            <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Math check</span>
            <h3 className="text-[28px] font-semibold tracking-tight mt-4 mb-3">One gig pays for a year.</h3>
            <p className="text-[15px] text-[#A1A1AA] max-w-[36ch]">A typical Pro user sends ~280 applications/month, gets ~22 replies, and books 2–4 new projects.</p>
          </div>
          <div className="hidden md:block h-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <div className="grid grid-cols-2 gap-6">
            {[
              { num: '$348', label: '/ year on Pro' },
              { num: '~$4,800', label: 'Avg first project' },
              { num: '14×', label: 'Median ROI in month 1' },
              { num: '5 days', label: 'To first reply' },
            ].map(s => (
              <div key={s.label}>
                <div className="text-[30px] font-semibold tracking-tight text-[#C7F94A]">{s.num}</div>
                <div className="text-[13px] text-[#A1A1AA] mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compare table */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[900px] mx-auto px-8">
          <div className="mb-10">
            <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Compare</span>
            <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4">Everything, side by side.</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="text-left">
                  <th className="py-3 px-4 font-mono text-[10.5px] tracking-widest uppercase text-[#6B7280] w-[40%]">Feature</th>
                  <th className="py-3 px-4 font-mono text-[10.5px] tracking-widest uppercase text-[#6B7280]">Free</th>
                  <th className="py-3 px-4 font-mono text-[10.5px] tracking-widest uppercase text-[#C7F94A]">Pro</th>
                  <th className="py-3 px-4 font-mono text-[10.5px] tracking-widest uppercase text-[#6B7280]">Agency</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { group: 'Discovery' },
                  { f: 'Live job feed', free: '●', pro: '●', agency: '●' },
                  { f: 'LinkedIn hiring-post discovery', free: '●', pro: '●', agency: '●' },
                  { f: 'Career-page crawler (3,500+)', free: 'Limited', pro: '●', agency: '●' },
                  { f: 'Early access window', free: '—', pro: '3 hrs', agency: '3 hrs' },
                  { group: 'Outreach' },
                  { f: 'AI cover letter / month', free: '10', pro: '500', agency: 'Unlimited' },
                  { f: 'Auto-apply with smart filters', free: '—', pro: '●', agency: '●' },
                  { f: 'Send from your own inbox', free: '—', pro: '●', agency: '●' },
                  { f: 'Auto follow-ups', free: '—', pro: '●', agency: '●' },
                  { f: 'AI model', free: 'Standard', pro: 'Premium', agency: 'Premium + Custom' },
                  { group: 'Tracking' },
                  { f: 'Reply & open tracking', free: 'Basic', pro: 'Full', agency: 'Full' },
                  { f: 'Per-template analytics', free: '—', pro: '●', agency: '●' },
                  { f: 'Pipeline / Kanban view', free: '—', pro: '●', agency: '●' },
                  { group: 'Team & integration' },
                  { f: 'Seats', free: '1', pro: '1', agency: '5 (+15/seat)' },
                  { f: 'Shared templates', free: '—', pro: '—', agency: '●' },
                  { f: 'Support', free: 'Email', pro: 'Email + chat', agency: 'Priority (4hr)' },
                ].map((row, i) => (
                  'group' in row ? (
                    <tr key={i}><td colSpan={4} className="py-3 px-4 font-mono text-[10.5px] tracking-widest uppercase text-[#6B7280] font-medium" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>{row.group}</td></tr>
                  ) : (
                    <tr key={i} className="hover:bg-white/[0.02]" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="py-3 px-4 text-[#D4D4D8]">{row.f}</td>
                      <td className="py-3 px-4 text-center text-[#A1A1AA]">{row.free === '●' ? <span className="text-[#4ADE80]">●</span> : row.free === '—' ? <span className="text-[#6B7280]">—</span> : row.free}</td>
                      <td className="py-3 px-4 text-center text-[#D4D4D8] font-medium">{row.pro === '●' ? <span className="text-[#C7F94A]">●</span> : row.pro === '—' ? <span className="text-[#6B7280]">—</span> : row.pro}</td>
                      <td className="py-3 px-4 text-center text-[#A1A1AA]">{row.agency === '●' ? <span className="text-[#4ADE80]">●</span> : row.agency === '—' ? <span className="text-[#6B7280]">—</span> : row.agency}</td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[880px] mx-auto px-8">
          <div className="mb-8">
            <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Common questions</span>
            <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4">Things people ask before signing up.</h2>
          </div>
          <div className="space-y-4">
            {[
              { q: 'Does this actually get me clients, or is it just spam?', a: "It's outreach, not spam. Every application is personalized to the specific job and sent from your real inbox. Our model is tuned for reply rate, not volume — the median Pro user sends ~280/month, not thousands. Spam doesn't get 8% reply rates." },
              { q: 'What happens to my data if I cancel?', a: 'Export everything (sent applications, replies, contacts, templates) to CSV with one click. We hard-delete your data within 30 days unless you ask us to keep it.' },
              { q: "Will hiring managers know it's AI?", a: "No — and we test for this. Cover letters reference specifics from the job post, your portfolio, and (when public) the hiring manager's background. They read like a thoughtful 3-minute write-up, not a template." },
              { q: 'Can I edit applications before they go out?', a: "Always. You can run in review mode (every draft waits for your OK) or auto mode (we send for you, you can recall within 60 minutes). Most Pro users start in review for a week, then flip to auto." },
              { q: "What if I'm just job-hunting, not freelancing?", a: "Freelanly works for both. About 30% of our users are looking for full-time remote roles. Same engine, same filters — just check \"FT roles\" in your preferences." },
              { q: 'Is there a free trial on Pro?', a: "Yes — 7 days, full access, no card required up front. If you don't book at least one interview, we'll extend it." },
            ].map(f => (
              <details key={f.q} className="group rounded-[14px] overflow-hidden" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                <summary className="flex items-center justify-between p-5 cursor-pointer text-[15px] font-medium hover:text-[#C7F94A] transition-colors list-none">{f.q}<span className="text-[#6B7280] ml-4 group-open:rotate-45 transition-transform text-xl">+</span></summary>
                <div className="px-5 pb-5 text-[14px] text-[#A1A1AA] leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link href="/about#faq" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[14px] border hover:bg-white/5 transition-colors" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>See all FAQs →</Link>
          </div>
        </div>
      </section>

      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
