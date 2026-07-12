'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { upload } from '@vercel/blob/client';
import { useTracker } from '@/hooks/useTracker';

const MAX_SECONDS = 120; // 2 minutes hard cap

/**
 * In-browser video-intro recorder: press record, talk 1-2 minutes, upload goes from the browser
 * STRAIGHT to Blob storage (client upload — the 4.5MB serverless body cap makes a server pass-
 * through impossible). Modal is portaled to <body> (iOS fixed-position anchor bug) and top-aligned.
 * MediaRecorder: Safari (iOS 14.3+) produces mp4, Chrome/Firefox webm — we take whichever the
 * browser supports.
 */
export function VideoRecorder({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (url: string) => void }) {
  const { track } = useTracker();
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview' | 'uploading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop(); } catch { /* already stopped */ }
    stopStream();
  };

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || typeof document === 'undefined') return null;

  async function startRecording() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 } }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play().catch(() => {});
      }
      const mime = ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
        stopStream();
        if (videoRef.current) {
          videoRef.current.srcObject = null;
          videoRef.current.src = URL.createObjectURL(blobRef.current);
          videoRef.current.muted = false;
          videoRef.current.controls = true;
        }
        setPhase('preview');
      };
      rec.start(1000);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds(s => {
          if (s + 1 >= MAX_SECONDS) { try { rec.stop(); } catch { /* noop */ } if (timerRef.current) clearInterval(timerRef.current); }
          return s + 1;
        });
      }, 1000);
      setPhase('recording');
      track('FUNNEL_STEP', { step: 'video_record_started' });
    } catch {
      setError('Camera/microphone access was blocked. Allow access in your browser settings and try again — or paste a Loom link in Settings instead.');
      setPhase('error');
    }
  }

  function stopRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { recorderRef.current?.stop(); } catch { /* noop */ }
  }

  async function uploadVideo() {
    if (!blobRef.current) return;
    setPhase('uploading');
    try {
      const ext = (blobRef.current.type || '').includes('mp4') ? 'mp4' : 'webm';
      const result = await upload(`video-intros/intro.${ext}`, blobRef.current, {
        access: 'public',
        handleUploadUrl: '/api/user/video-upload',
      });
      // Belt-and-braces: also save via settings (onUploadCompleted covers prod, this covers everything).
      await fetch('/api/user/settings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: 'profile', videoIntroUrl: result.url }),
      }).catch(() => {});
      track('FUNNEL_STEP', { step: 'video_uploaded' });
      setPhase('done');
      onDone(result.url);
    } catch {
      setError('Upload failed — check your connection and try again.');
      setPhase('preview');
    }
  }

  function retake() {
    blobRef.current = null;
    if (videoRef.current) { videoRef.current.src = ''; videoRef.current.controls = false; }
    startRecording();
  }

  const mm = String(Math.floor(seconds / 60)).padStart(1, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return createPortal(
    <div onClick={() => { cleanup(); onClose(); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '520px', overflow: 'hidden', border: '1px solid rgba(11,12,15,0.12)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(11,12,15,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>🎬 Record your intro (1-2 min, in English)</div>
          <button onClick={() => { cleanup(); onClose(); }} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5C6068' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {phase === 'idle' && (
            <div style={{ fontSize: '13px', color: '#5C6068', lineHeight: 1.6, marginBottom: '14px' }}>
              Say who you are, what you build, and what you&apos;re looking for. Employers pick candidates
              they can see and hear — this takes 2 minutes and puts you ahead of every profile without one.
            </div>
          )}
          {(phase === 'error') && <div style={{ fontSize: '13px', color: '#B91C1C', lineHeight: 1.5, marginBottom: '12px' }}>{error}</div>}
          {error && phase === 'preview' && <div style={{ fontSize: '13px', color: '#B91C1C', marginBottom: '10px' }}>{error}</div>}

          <video ref={videoRef} playsInline style={{ width: '100%', borderRadius: '10px', background: '#0A0B0F', aspectRatio: '4/3', display: phase === 'idle' || phase === 'error' || phase === 'done' ? 'none' : 'block' }} />

          {phase === 'recording' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13px', color: '#B91C1C', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#DC2626', display: 'inline-block', animation: 'pulse 1s infinite' }} />
              REC {mm}:{ss} / 2:00
            </div>
          )}
          {phase === 'done' && (
            <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '14px', color: '#166534', fontWeight: 600 }}>
              ✓ Video saved to your profile — employers will see it on your card.
            </div>
          )}
        </div>

        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(11,12,15,0.07)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {phase === 'idle' && <button className="btn btn-acid" onClick={startRecording}>Start recording</button>}
          {phase === 'error' && <button className="btn btn-acid" onClick={startRecording}>Try again</button>}
          {phase === 'recording' && <button className="btn btn-primary" onClick={stopRecording}>Stop</button>}
          {phase === 'preview' && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={retake}>Re-record</button>
              <button className="btn btn-acid" onClick={uploadVideo}>Use this video →</button>
            </>
          )}
          {phase === 'uploading' && <button className="btn btn-acid" disabled>Uploading…</button>}
          {phase === 'done' && <button className="btn btn-primary" onClick={() => { cleanup(); onClose(); }}>Done</button>}
        </div>
      </div>
    </div>,
    document.body
  );
}
