'use client';

import { useEffect, useState } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { VideoRecorder } from '@/components/app/VideoRecorder';

/**
 * Dashboard nudge: the two profile artifacts that turn a résumé into a SELLABLE candidate —
 * a 1-2 min video intro (async proof of English/identity/communication) and a GitHub link
 * (feeds the code-verification pipeline). Deliberately NOT in the signup form (friction);
 * asked only after the user already has a complete profile. Video records RIGHT HERE in the
 * browser (owner call: a record button, not a link field) and uploads client-side to Blob.
 */
export function ProfileBoostNudge({ askVideo, askGithub }: { askVideo: boolean; askGithub: boolean }) {
  const { track } = useTracker();
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [videoDone, setVideoDone] = useState(false);

  useEffect(() => {
    track('FUNNEL_STEP', { step: 'profile_boost_shown', video: askVideo, github: askGithub });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showVideo = askVideo && !videoDone;
  if (!showVideo && !askGithub) return null;

  return (
    <div className="card mb-4" style={{ padding: '14px 20px' }}>
      <div style={{ fontSize: '11px', fontFamily: "'Geist Mono', monospace", textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-4)', marginBottom: '2px' }}>
        Get shortlisted first
      </div>

      {showVideo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
          <div style={{ fontSize: '20px', flexShrink: 0 }}>🎬</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Record a 1-2 minute intro video</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-4)', lineHeight: 1.45 }}>
              Right here, in English — employers pick candidates they can see and hear.
            </div>
          </div>
          <button
            className="btn btn-acid btn-sm"
            style={{ flexShrink: 0 }}
            onClick={() => { track('FUNNEL_STEP', { step: 'video_nudge_click' }); setRecorderOpen(true); }}
          >Record now</button>
        </div>
      )}

      {showVideo && askGithub && <div style={{ borderTop: '1px solid var(--line)' }} />}

      {askGithub && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}>
          <div style={{ fontSize: '20px', flexShrink: 0 }}>⚡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 600 }}>Add your GitHub</div>
            <div style={{ fontSize: '12px', color: 'var(--ink-4)', lineHeight: 1.45 }}>
              We review your real code and show employers proof, not promises — verified profiles stand out.
            </div>
          </div>
          <a
            href="/dashboard/settings#profile"
            className="btn btn-acid btn-sm"
            style={{ flexShrink: 0 }}
            onClick={() => track('FUNNEL_STEP', { step: 'github_nudge_click' })}
          >Add GitHub</a>
        </div>
      )}

      <VideoRecorder open={recorderOpen} onClose={() => setRecorderOpen(false)} onDone={() => setVideoDone(true)} />
    </div>
  );
}
