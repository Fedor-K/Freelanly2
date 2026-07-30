'use client';

import { useEffect } from 'react';
import { useTracker } from '@/hooks/useTracker';

/**
 * Dashboard nudge — GitHub only. What the review ACTUALLY does: verifies skills from real code that
 * feed OUR match gate + feed ranking/badges. It does NOT reach employers by default — the in-letter
 * GitHub line is shadowed (GITHUB_LETTERS !== 'on') and the recruiter portal is near-dead. Copy
 * rewritten 2026-07-30 (owner) to stop claiming "show employers proof" — the honest value is internal
 * (better matching + higher feed rank). The video-intro half was killed 2026-07-23 (owner): 7-day
 * funnel was 229 nudge clicks → 27 recordings started → 1 upload.
 */
export function ProfileBoostNudge({ askGithub }: { askGithub: boolean }) {
  const { track } = useTracker();

  useEffect(() => {
    track('FUNNEL_STEP', { step: 'profile_boost_shown', github: askGithub });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!askGithub) return null;

  return (
    <div className="card mb-4" style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: '11px', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: '2px' }}>
        Get stronger matches
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
        <div style={{ fontSize: '20px', flexShrink: 0 }}>⚡</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Add your GitHub</div>
          <div style={{ fontSize: '12px', color: 'var(--ink-4)', lineHeight: 1.45 }}>
            We check your real code to verify your skills — verified profiles clear our match filter and rank higher in your feed.
          </div>
        </div>
        <a
          href="/dashboard/settings#profile"
          className="btn btn-acid btn-sm"
          style={{ flexShrink: 0 }}
          onClick={() => track('FUNNEL_STEP', { step: 'github_nudge_click' })}
        >Add GitHub</a>
      </div>
    </div>
  );
}
