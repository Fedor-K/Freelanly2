'use client';

import { useEffect } from 'react';
import { useTracker } from '@/hooks/useTracker';

/**
 * Dashboard nudge: the two profile artifacts that turn a résumé into a SELLABLE candidate —
 * a 1-2 min video intro (async proof of English/identity/communication) and a GitHub link
 * (feeds the code-verification pipeline). Deliberately NOT in the signup form (friction);
 * asked only after the user already has a complete profile.
 */
export function ProfileBoostNudge({ askVideo, askGithub }: { askVideo: boolean; askGithub: boolean }) {
  const { track } = useTracker();

  useEffect(() => {
    track('FUNNEL_STEP', { step: 'profile_boost_shown', video: askVideo, github: askGithub });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!askVideo && !askGithub) return null;

  const row = (emoji: string, title: string, sub: string, cta: string, step: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
      <div style={{ fontSize: '20px', flexShrink: 0 }}>{emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13.5px', fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--ink-4)', lineHeight: 1.45 }}>{sub}</div>
      </div>
      <a
        href="/dashboard/settings#profile"
        className="btn btn-acid btn-sm"
        style={{ flexShrink: 0 }}
        onClick={() => track('FUNNEL_STEP', { step })}
      >{cta}</a>
    </div>
  );

  return (
    <div className="card mb-4" style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: '11px', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: '2px' }}>
        Get shortlisted first
      </div>
      {askVideo && row(
        '🎬',
        'Add a 1-2 minute intro video',
        'Record on Loom or your phone, in English — employers pick candidates they can see and hear.',
        'Add video',
        'video_nudge_click',
      )}
      {askVideo && askGithub && <div style={{ borderTop: '1px solid var(--line)' }} />}
      {askGithub && row(
        '⚡',
        'Add your GitHub',
        'We review your real code and show employers proof, not promises — verified profiles stand out.',
        'Add GitHub',
        'github_nudge_click',
      )}
    </div>
  );
}
