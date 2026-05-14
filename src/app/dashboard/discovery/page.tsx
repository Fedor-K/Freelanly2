import { Metadata } from 'next';
import './discovery-design.css';

export const metadata: Metadata = {
  title: 'Discovery — Freelanly',
};

export default function DiscoveryPage() {
  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Discovery <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· 142 new today</span></h1>
          <p>Live feed across LinkedIn posts, career pages, and freelance boards. Updated every 3 hours.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Refresh feed
          </button>
          <button className="btn btn-acid">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Auto-apply to all
          </button>
        </div>
      </div>

      <div className="disco-grid">

        {/* Filters */}
        <aside className="card" style={{position: 'sticky', top: '72px'}}>
          <div className="filter-section">
            <h4>Saved feeds</h4>
            <div className="filter-list">
              <div className="filter-item on"><div className="left"><span style={{color: 'var(--acid-deep)'}}>●</span> EU React contracts</div><span className="count">142</span></div>
              <div className="filter-item"><div className="left"><span style={{color: 'var(--info)'}}>●</span> Brand design retainers</div><span className="count">38</span></div>
              <div className="filter-item"><div className="left"><span style={{color: 'var(--warn)'}}>●</span> Long-term retainers</div><span className="count">11</span></div>
              <div className="filter-item"><div className="left"><span className="dim">+</span> New feed</div></div>
            </div>
          </div>
          <div className="filter-section">
            <h4>Tech / Skills</h4>
            <div className="filter-list">
              <div className="filter-item on"><div className="left"><span className="cb"></span>React</div><span className="count">87</span></div>
              <div className="filter-item on"><div className="left"><span className="cb"></span>TypeScript</div><span className="count">62</span></div>
              <div className="filter-item"><div className="left"><span className="cb"></span>Next.js</div><span className="count">41</span></div>
              <div className="filter-item"><div className="left"><span className="cb"></span>Node.js</div><span className="count">38</span></div>
              <div className="filter-item"><div className="left"><span className="cb"></span>React Native</div><span className="count">22</span></div>
            </div>
          </div>
          <div className="filter-section">
            <h4>Location / TZ</h4>
            <div className="filter-list">
              <div className="filter-item on"><div className="left"><span className="cb"></span>Remote</div><span className="count">128</span></div>
              <div className="filter-item on"><div className="left"><span className="cb"></span>EU TZ</div><span className="count">94</span></div>
              <div className="filter-item"><div className="left"><span className="cb"></span>US TZ</div><span className="count">52</span></div>
              <div className="filter-item"><div className="left"><span className="cb"></span>On-site</div><span className="count">14</span></div>
            </div>
          </div>
          <div className="filter-section">
            <h4>Source</h4>
            <div className="filter-list">
              <div className="filter-item on"><div className="left"><span className="cb"></span>LinkedIn posts</div><span className="count">96</span></div>
              <div className="filter-item on"><div className="left"><span className="cb"></span>Career pages</div><span className="count">46</span></div>
            </div>
          </div>
          <div className="filter-section">
            <h4>Exclude</h4>
            <div className="row" style={{flexWrap: 'wrap', gap: '4px'}}>
              <span className="tag" style={{borderColor: 'rgba(185,28,28,0.2)', color: 'var(--bad)'}}>− Web3</span>
              <span className="tag" style={{borderColor: 'rgba(185,28,28,0.2)', color: 'var(--bad)'}}>− &quot;rockstar&quot;</span>
              <span className="tag" style={{borderColor: 'rgba(185,28,28,0.2)', color: 'var(--bad)'}}>− unpaid</span>
              <span className="tag" style={{borderColor: 'rgba(185,28,28,0.2)', color: 'var(--bad)'}}>− on-site</span>
              <button className="tag" style={{background: 'transparent', color: 'var(--ink-4)'}}>+ add</button>
            </div>
          </div>
          <div className="filter-section">
            <button className="btn btn-soft" style={{width: '100%'}}>Reset all filters</button>
          </div>
        </aside>

        {/* Results */}
        <div className="card">
          <div className="card-head">
            <div className="row gap-3">
              <h3>142 results</h3>
              <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Live feed</span>
            </div>
            <div className="row gap-2">
              <span className="muted f-mono" style={{fontSize: '11px'}}>Sort:</span>
              <div className="seg">
                <button className="active">Best match</button>
                <button>Newest</button>
              </div>
            </div>
          </div>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#FF6B6B'}}>L</div>
            <div>
              <div className="row gap-2"><div className="job-title">Senior React Developer</div><span className="chip chip-acid"><span className="chip-dot live"></span>2m ago</span></div>
              <div className="job-company">Linear · linkedin.com/posts/sarah-chen</div>
              <div className="job-snippet">&quot;Hiring a senior React dev for our <b>mobile sync engine</b>. Offline-first, CRDT background, fully remote. <b>$90K/yr equiv</b>, EU TZ preferred.&quot;</div>
              <div className="job-meta">
                <span className="tag tag-acid">React</span>
                <span className="tag tag-acid">TypeScript</span>
                <span className="tag">Remote</span>
                <span className="tag">EU TZ</span>
                <span className="tag">Long-term</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/>
                  <circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="6" strokeLinecap="round"/>
                </svg>
                <div className="val">96</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Apply
                </button>
              </div>
            </div>
          </a>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#A8E024'}}>V</div>
            <div>
              <div className="row gap-2"><div className="job-title">Full-Stack Engineer · contract</div><span className="chip"><span className="chip-dot live"></span>12m ago</span></div>
              <div className="job-company">Vercel · vercel.com/careers</div>
              <div className="job-snippet">&quot;Contract role on the <b>Edge Runtime team</b>. Need someone comfortable shipping serverless infra. <b>$110/hr</b>, 6-month minimum, fully remote.&quot;</div>
              <div className="job-meta">
                <span className="tag tag-acid">React</span>
                <span className="tag tag-acid">TypeScript</span>
                <span className="tag">Next.js</span>
                <span className="tag">Contract · 6mo</span>
                <span className="tag" style={{borderColor: 'rgba(199,249,74,0.4)', color: 'var(--acid-deep)'}}>3h ahead of LinkedIn</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="14" strokeLinecap="round"/></svg>
                <div className="val">91</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Apply
                </button>
              </div>
            </div>
          </a>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#FFB951'}}>P</div>
            <div>
              <div className="row gap-2"><div className="job-title">React Native engineer — onboarding refresh</div><span className="chip">34m ago</span></div>
              <div className="job-company">Plain · plain.com/jobs</div>
              <div className="job-snippet">&quot;4–6 week project to <b>rebuild our mobile onboarding</b>. We have specs &amp; design, need an engineer who can ship fast. <b>$8K total</b>.&quot;</div>
              <div className="job-meta">
                <span className="tag tag-acid">React Native</span>
                <span className="tag tag-acid">TypeScript</span>
                <span className="tag">Project · 4–6 wks</span>
                <span className="tag">Remote</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="9" strokeLinecap="round"/></svg>
                <div className="val">94</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Apply
                </button>
              </div>
            </div>
          </a>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#6EE7FF'}}>S</div>
            <div>
              <div className="row gap-2"><div className="job-title">Brand &amp; Web Designer</div><span className="chip">1h ago</span></div>
              <div className="job-company">Stripe · linkedin.com/posts/marcus-d</div>
              <div className="job-snippet">&quot;Building out our <b>developer-tools brand</b> ahead of 2026 launches. Need a designer for 3 months of focused work. $130K/yr equiv.&quot;</div>
              <div className="job-meta">
                <span className="tag">Brand design</span>
                <span className="tag">Figma</span>
                <span className="tag">SF / remote</span>
                <span className="tag">3-month sprint</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="33" strokeLinecap="round"/></svg>
                <div className="val">78</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">Review</button>
              </div>
            </div>
          </a>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#A78BFA'}}>R</div>
            <div>
              <div className="row gap-2"><div className="job-title">DevOps Engineer (contract)</div><span className="chip">2h ago</span></div>
              <div className="job-company">Railway · railway.app/jobs</div>
              <div className="job-snippet">&quot;Infrastructure-as-code, K8s, observability. <b>$95–$120/hr</b>, async, fully remote, EU TZ preferred.&quot;</div>
              <div className="job-meta">
                <span className="tag">DevOps</span>
                <span className="tag">Kubernetes</span>
                <span className="tag">Terraform</span>
                <span className="tag">EU TZ</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="20" strokeLinecap="round"/></svg>
                <div className="val">87</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Apply
                </button>
              </div>
            </div>
          </a>

          <a href="#" className="job-card">
            <div className="logo" style={{background:'#34D399'}}>N</div>
            <div>
              <div className="row gap-2"><div className="job-title">Frontend Engineer · long-term</div><span className="chip">3h ago</span></div>
              <div className="job-company">Notion · linkedin.com/posts/jamie-l</div>
              <div className="job-snippet">&quot;Looking for a frontend engineer to <b>own the editor performance</b> work. Long-term retainer, $120K/yr equiv.&quot;</div>
              <div className="job-meta">
                <span className="tag tag-acid">React</span>
                <span className="tag">Performance</span>
                <span className="tag">Retainer</span>
                <span className="tag">Remote</span>
              </div>
            </div>
            <div className="job-right">
              <div className="match-circle">
                <svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="24" fill="none" stroke="var(--bg-2)" strokeWidth="4"/><circle cx="28" cy="28" r="24" fill="none" stroke="var(--acid-deep)" strokeWidth="4" strokeDasharray="150.79" strokeDashoffset="11" strokeLinecap="round"/></svg>
                <div className="val">93</div>
              </div>
              <div className="job-actions">
                <button className="btn btn-ghost btn-sm">Skip</button>
                <button className="btn btn-primary btn-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Apply
                </button>
              </div>
            </div>
          </a>

          <div style={{padding: '14px 20px', textAlign: 'center'}}>
            <button className="btn btn-soft">Load 136 more results</button>
          </div>
        </div>

      </div>

    </div>
  );
}
