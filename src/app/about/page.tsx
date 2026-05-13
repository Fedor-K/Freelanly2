import { Metadata } from 'next';
import { MarketingNav, MarketingCTA, MarketingFooter } from '@/components/marketing/MarketingShell';

export const metadata: Metadata = {
  title: 'About — Freelanly',
  description: 'Built by freelancers who got tired of applying. 10,000+ freelancers in 90+ countries.',
};

export default function AboutPage() {
  return (
    <div style={{ background: '#0A0B0F', color: '#FAFAFA' }}>
      <MarketingNav />

      {/* Hero */}
      <header className="pt-28 pb-16">
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#C7F94A]">— About</span>
          <h1 className="text-[clamp(40px,5.5vw,68px)] font-semibold tracking-tighter mt-4 mb-5 leading-none">Built by freelancers who got<br />tired of applying.</h1>
          <p className="text-[19px] text-[#D4D4D8] leading-relaxed max-w-[60ch]">In 2024, our co-founder spent 90 minutes every morning refreshing Upwork and Indeed for half-decent contracts. He shipped one line of client code per day. So he built Freelanly. Now 10,000+ freelancers in 90+ countries run their outreach this way.</p>
        </div>
      </header>

      {/* Manifesto */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[720px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Manifesto</span>
          <div className="mt-8 space-y-6 text-[17px] text-[#D4D4D8] leading-relaxed">
            <p>We started with one belief: the freelancer&apos;s biggest cost isn&apos;t taxes or tools — it&apos;s the <strong className="text-white">time spent looking for the next gig</strong>. A typical full-time freelancer loses 8–12 hours a week to job-hunting. That&apos;s a full billable day. Every week.</p>
            <p>The job-board industry doesn&apos;t want to fix this. Their business model depends on you refreshing the same feed 30 times a day. Their feeds depend on listings that have already been seen by 500 people.</p>
            <p>We&apos;re building the opposite of a job board. A feed that catches openings <strong className="text-white">before they hit the boards</strong>, writes the email for you, and sends it — so you can be back to the work that pays.</p>
            <p>Freelanly is a tool, not a community. We don&apos;t sell ads to recruiters. We don&apos;t sell your data. Our only customer is you, the freelancer, and our only metric is whether you book more work with less time on the application treadmill.</p>
            <p className="text-[#6B7280]">If we ever stop doing that — leave. Take your data with you. We&apos;ll help you set up a competitor.</p>
          </div>

          {/* Founder quote */}
          <div className="mt-12 p-7 rounded-[14px] relative" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
            <blockquote className="text-[19px] text-[#D4D4D8] leading-relaxed italic">&ldquo;I built Freelanly because I&apos;d lost three good contracts to someone who replied two hours earlier than me. That&apos;s it. That&apos;s the whole insight.&rdquo;</blockquote>
            <div className="mt-4 font-mono text-[13px] text-[#A1A1AA]">— Daniil V., Founder &amp; CEO</div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[900px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Timeline</span>
          <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-10">Two years. Two co-founders. 10,000+ users.</h2>
          <div className="space-y-6">
            {[
              { date: 'Mar · 2024', title: 'One-day side project', desc: 'Daniil scripts a LinkedIn scraper to find React contracts before they hit Upwork. Uses it personally for 3 weeks. Lands 2 retainers.' },
              { date: 'Oct · 2024', title: 'First 100 users', desc: 'Posts on Indie Hackers. First 100 paying users sign up in a week. AI cover-letter feature ships, becomes the #1 reason people stay.' },
              { date: 'May · 2025', title: 'The auto-apply engine', desc: 'Maya joins as CTO. Builds the rules engine, the throttling system, the unified inbox. The product becomes a tool, not a hack.' },
              { date: 'Today', title: '10K+ freelancers · 90+ countries', desc: '500+ applications go out daily. 5% reply rate, on average. No outside funding. Profitable since month 9.' },
            ].map(t => (
              <div key={t.date} className="grid grid-cols-[120px_1fr] gap-6 items-start" >
                <div className="font-mono text-[13px] text-[#C7F94A] pt-1">{t.date}</div>
                <div className="pb-6" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="text-[18px] font-semibold tracking-tight mb-2">{t.title}</h3>
                  <p className="text-[15px] text-[#A1A1AA] leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— What we believe</span>
          <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-10">Three rules we won&apos;t break.</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { num: '01', title: 'Your time is the product.', desc: 'Every feature is judged by one question: does it give the freelancer an hour back? If not, we don\'t build it. Even if it would look great in a launch tweet.' },
              { num: '02', title: 'No dark patterns. Ever.', desc: 'One-click cancel. One-click data export. No hidden upsells, no "are you sure you want to leave" four-step downgrade flows. We compete on the product, not the friction.' },
              { num: '03', title: 'Reply rate, not application count.', desc: 'Spam tools optimize for volume. We optimize for replies. If we ever start bragging about "100,000 applications sent" instead of reply quality, fire us.' },
            ].map(v => (
              <div key={v.num} className="p-7 rounded-[14px]" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="font-mono text-xs tracking-widest uppercase text-[#C7F94A] mb-4">— {v.num}</div>
                <h3 className="text-[18px] font-semibold tracking-tight mb-3">{v.title}</h3>
                <p className="text-[14px] text-[#A1A1AA] leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[1240px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— The team</span>
          <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-10">Four people. No middle managers.</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { initials: 'DV', name: 'Daniil Volkov', role: 'Founder, CEO', desc: 'Ex-freelance React dev. Built v1 in a week. Still answers support emails.', color: '#C7F94A' },
              { initials: 'MO', name: 'Maya Okafor', role: 'CTO', desc: 'Built the rules engine and the inbox. Previously at Plain & Linear.', color: '#FF6B6B' },
              { initials: 'RT', name: 'Ravi Thakkar', role: 'Head of AI', desc: 'The cover-letter model lives in his head. ML/NLP background.', color: '#6EE7FF' },
              { initials: 'SC', name: 'Sofia Chen', role: 'Design & growth', desc: 'Designed this site. Runs the freelancer community calls.', color: '#A78BFA' },
            ].map(m => (
              <div key={m.initials} className="text-center">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 grid place-items-center font-mono font-semibold text-xl text-black" style={{ background: m.color }}>{m.initials}</div>
                <div className="text-[15px] font-semibold mb-0.5">{m.name}</div>
                <div className="font-mono text-[11px] text-[#A1A1AA] tracking-wider uppercase mb-2">— {m.role}</div>
                <p className="text-[13px] text-[#6B7280] leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-[800px] mx-auto px-8">
          <span className="font-mono text-xs tracking-widest uppercase text-[#A1A1AA]">— Common questions</span>
          <h2 className="text-[clamp(30px,3.5vw,44px)] font-semibold tracking-tighter mt-4 mb-10">Things people ask before signing up.</h2>
          <div className="space-y-4">
            {[
              { q: 'Does this actually get me clients, or is it just spam?', a: "It's outreach, not spam. Every application is personalized to the specific job and sent from your real inbox. Our model is tuned for reply rate, not volume — the median user sends ~280/month, not thousands. Spam doesn't get 5% reply rates." },
              { q: 'What happens to my data if I cancel?', a: 'Export everything (sent applications, replies, contacts, templates) to CSV with one click. We hard-delete your data within 30 days unless you ask us to keep it.' },
              { q: 'Can I edit applications before they go out?', a: "Always. You can run in review mode (every draft waits for your OK) or auto mode (we send for you, you can recall within 60 minutes). Most Pro users start in review for a week, then flip to auto." },
              { q: "What if I'm just job-hunting, not freelancing?", a: 'Freelanly works for both. About 30% of our users are looking for full-time remote roles. Same engine, same filters — just check "FT roles" in your preferences.' },
              { q: 'Is there a free trial on Pro?', a: "Yes — 7 days, full access, no card required up front. If you don't book at least one interview, we'll extend it." },
              { q: "Will hiring managers know it's AI?", a: "The cover letters are tuned to sound human — they reference specific details from the job post and your portfolio. Most replies we get say things like \"your note stood out\" — they don't suspect AI." },
            ].map(f => (
              <details key={f.q} className="group rounded-[14px] overflow-hidden" style={{ background: '#0E1016', border: '1px solid rgba(255,255,255,0.08)' }}>
                <summary className="flex items-center justify-between p-5 cursor-pointer text-[15px] font-medium hover:text-[#C7F94A] transition-colors list-none">{f.q}<span className="text-[#6B7280] ml-4 group-open:rotate-45 transition-transform text-xl">+</span></summary>
                <div className="px-5 pb-5 text-[14px] text-[#A1A1AA] leading-relaxed">{f.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      <MarketingCTA />
      <MarketingFooter />
    </div>
  );
}
