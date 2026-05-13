import { Metadata } from 'next';
import Link from 'next/link';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: 'Pricing — Freelanly · from $0/mo',
  description: 'Start free. Upgrade when your inbox starts filling up. Cancel any time.',
  alternates: { canonical: `${siteConfig.url}/pricing` },
};

const Check = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>;
const Cross = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>;

export default function PricingPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      {/* Nav */}
      <nav className="h-16 flex items-center px-8" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,11,15,0.72)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-[1240px] mx-auto w-full flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 font-semibold text-[17px]">
            <span className="w-[26px] h-[26px] rounded-[7px] grid place-items-center font-mono font-bold text-sm" style={{ background: '#C7F94A', color: '#000' }}>F</span>
            <span>Freelanly</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 flex-1 text-[14px] text-[#A1A1AA]">
            <Link href="/how-it-works" className="hover:text-white transition-colors">How it works</Link>
            <Link href="/features" className="hover:text-white transition-colors">Features</Link>
            <Link href="/pricing" className="text-white">Pricing</Link>
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-[14px] px-4 py-2 rounded-full border" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Sign in</Link>
            <Link href="/auth/signin" className="text-[14px] px-4 py-2 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free</Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="pt-20 pb-12 text-center relative overflow-hidden">
        <div className="absolute top-[-100px] left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(199,249,74,0.14), transparent 70%)' }} />
        <div className="max-w-[1240px] mx-auto px-8 relative z-10">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Pricing</span>
          <h1 className="text-[clamp(36px,4.4vw,56px)] font-semibold tracking-tighter mt-4">
            Pay less than <span className="text-[#C7F94A]">one billable hour</span>.<br/>Apply to a thousand gigs.
          </h1>
          <p className="text-[19px] text-[#D4D4D8] mt-4 max-w-[50ch] mx-auto leading-relaxed">
            Start free. Upgrade when your inbox starts filling up. Cancel any time — your data goes with you.
          </p>
        </div>
      </header>

      {/* Plans */}
      <section className="pb-24">
        <div className="max-w-[1100px] mx-auto px-8">
          <div className="grid md:grid-cols-3 gap-5 items-start">
            
            {/* FREE */}
            <div className="rounded-2xl p-7" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[15px] font-semibold mb-2">Free</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">See what Freelanly catches before you commit.</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[13px] text-[#A1A1AA]">$</span>
                <span className="text-[48px] font-semibold tracking-tighter leading-none">0</span>
              </div>
              <div className="text-[13px] text-[#6B7280] mb-6">forever, on us</div>
              <Link href="/auth/signin" className="block w-full text-center py-3 rounded-full text-[14px] font-medium border mb-7" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>Start free</Link>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6B7280] mb-3">What&apos;s included</div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>25</strong> AI applications / month</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Browse all live gigs</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> AI cover letter</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> 1 follow-up per application</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Reply sentiment preview</li>
                <li className="flex items-center gap-2.5 text-[#6B7280]"><Cross /> Full reply text</li>
                <li className="flex items-center gap-2.5 text-[#6B7280]"><Cross /> Send from own inbox</li>
              </ul>
            </div>

            {/* PRO */}
            <div className="rounded-2xl p-7 relative" style={{ background: '#0E1016', border: '2px solid #C7F94A', boxShadow: '0 0 60px -20px rgba(199,249,74,0.18)' }}>
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest uppercase px-3 py-1 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#000' }}>Most popular</span>
              <div className="text-[15px] font-semibold mb-2 text-[#C7F94A]">Pro</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">Auto-apply + AI cover letters + follow-ups, on autopilot.</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[13px] text-[#A1A1AA]">$</span>
                <span className="text-[48px] font-semibold tracking-tighter leading-none">29</span>
                <span className="text-[15px] text-[#A1A1AA] ml-1">/ month</span>
              </div>
              <div className="text-[13px] text-[#6B7280] mb-6">billed monthly</div>
              <Link href="/auth/signin" className="block w-full text-center py-3 rounded-full text-[14px] font-semibold mb-7" style={{ background: '#C7F94A', color: '#000' }}>Start 7-day free trial →</Link>
              <div className="font-mono text-[10px] tracking-widest uppercase text-[#6B7280] mb-3">Everything in Free, plus</div>
              <ul className="space-y-2.5 text-[13.5px]">
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>500</strong> AI applications / month</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>Auto-apply</strong> with smart filters</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> <strong>Auto follow-ups</strong> (3 touches)</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Full reply text + email forwarding</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Premium AI model</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Send from your own inbox</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Tracking &amp; reply analytics</li>
                <li className="flex items-center gap-2.5 text-[#D4D4D8]"><Check /> Early access to new jobs (3hr edge)</li>
              </ul>
            </div>

            {/* AGENCY */}
            <div className="rounded-2xl p-7" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-[15px] font-semibold mb-2">Agency</div>
              <p className="text-[13px] text-[#A1A1AA] mb-5">For studios &amp; small teams running outreach for multiple freelancers.</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-[13px] text-[#A1A1AA]">$</span>
                <span className="text-[48px] font-semibold tracking-tighter leading-none">89</span>
                <span className="text-[15px] text-[#A1A1AA] ml-1">/ month</span>
              </div>
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

          <p className="text-center text-[14px] text-[#6B7280] mt-7">
            All plans include unlimited browsing · No credit card to start · Cancel any time
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(199,249,74,0.10) 0%, transparent 60%)' }} />
        <div className="relative z-10">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— Try the whole stack</span>
          <h2 className="text-[clamp(28px,3.5vw,40px)] font-semibold tracking-tighter mt-4 mb-5">All features, free for 7 days.</h2>
          <p className="text-[#D4D4D8] mb-8">No credit card. Cancel any time. Take your data with you if you go.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/auth/signin" className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold" style={{ background: '#C7F94A', color: '#0A0B0F' }}>Start free trial →</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center text-[13px] text-[#6B7280]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        © 2026 Freelanly · <Link href="/privacy" className="hover:text-[#C7F94A]">Privacy</Link> · <Link href="/terms" className="hover:text-[#C7F94A]">Terms</Link>
      </footer>
    </div>
  );
}
