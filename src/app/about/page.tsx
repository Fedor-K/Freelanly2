import { Metadata } from 'next';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'About — Freelanly',
  description: 'AI outreach engine for freelancers. We help you be first in the inbox and win the project.',
};

const faqs = [
  { q: 'Does this actually get me clients, or is it just spam?', a: "It's outreach, not spam. Every application is personalized to the specific job and sent from your real inbox. Our model is tuned for reply rate, not volume." },
  { q: 'What happens to my data if I cancel?', a: 'Export everything (applications, replies, contacts, templates) to CSV with one click. We hard-delete your data within 30 days.' },
  { q: 'Can I edit applications before they go out?', a: 'Always. Run in review mode (every draft waits for your OK) or auto mode. Most users start in review, then flip to auto.' },
  { q: "What if I'm just job-hunting, not freelancing?", a: 'Freelanly works for both. About 30% of our users look for full-time remote roles. Same engine, same filters.' },
  { q: 'Is there a free trial on Pro?', a: 'Yes — 7 days, full access, no card required up front.' },
  { q: "Will hiring managers know it's AI?", a: "The cover letters reference specific details from the job post and your portfolio. Most replies say \"your note stood out\" — they don't suspect AI." },
];

export default function AboutPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />
      <header className="pt-28 pb-16">
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— About</span>
          <h1 className="text-[clamp(40px,5.5vw,68px)] font-semibold tracking-tighter mt-4 mb-5 leading-none">We built the tool we<br />wished existed.</h1>
          <p className="text-[19px] text-[#D4D4D8] leading-relaxed max-w-[60ch]">Freelanly started because we were tired of writing the same cover letter 30 times a week. Now AI does it — better, faster, and without the burnout.</p>
        </div>
      </header>
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[720px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Manifesto</span>
          <div className="mt-8 space-y-6 text-[17px] text-[#D4D4D8] leading-relaxed">
            <p>Freelancing should be about doing great work — not spending 90 minutes every morning refreshing job boards.</p>
            <p>We believe the best freelancers lose gigs not because they lack talent, but because someone else applied <strong className="text-white">18 hours earlier</strong>.</p>
            <p>So we built a system that watches every hiring signal across LinkedIn and 3,500+ career pages, writes a personalized application in your voice, and sends it before the listing goes stale.</p>
            <p>The result: you wake up to replies, not to-do lists.</p>
          </div>
        </div>
      </section>
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— What we believe</span>
          <div className="grid md:grid-cols-3 gap-6 mt-10">
            {[{ t: 'Speed wins deals', d: 'The first qualified reply gets the call. We optimize for time-to-inbox, not volume.' },{ t: 'Personalization over scale', d: 'One good email beats 50 generic ones. Every application references the actual job post.' },{ t: 'Your data, your rules', d: 'Export everything. Delete anytime. We never sell your data or share your résumé without approval.' }].map(v => (
              <div key={v.t} className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                <h3 className="text-[18px] font-semibold tracking-tight mb-3">{v.t}</h3>
                <p className="text-[14px] text-[#A1A1AA] leading-relaxed">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[800px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Common questions</span>
          <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-10">Things people ask before signing up.</h2>
          <div className="space-y-4">
            {faqs.map(f => (
              <details key={f.q} className="group rounded-[14px] overflow-hidden" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                <summary className="flex items-center justify-between p-5 cursor-pointer text-[15px] font-medium hover:text-[#C7F94A] transition-colors list-none">{f.q}<span className="text-[#6B7280] ml-4 group-open:rotate-45 transition-transform text-xl">+</span></summary>
                <div className="px-5 pb-5 text-[14px] text-[#A1A1AA] leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="py-20 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Get in touch</span>
        <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-5">Questions? Just ask.</h2>
        <p className="text-[17px] text-[#D4D4D8] mb-8">Email us at <a href="mailto:hi@freelanly.com" className="text-[#C7F94A] underline underline-offset-4">hi@freelanly.com</a></p>
      </section>
      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
