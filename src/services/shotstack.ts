/**
 * Shotstack Video Generation Service
 * API docs: https://shotstack.io/docs/api/
 */

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || 'A9XHX9aYgC6bC7flRDC67FALUIOvPU1whxtQSrHx';
const SHOTSTACK_OWNER_ID = process.env.SHOTSTACK_OWNER_ID || 'vp6hc8knbo';
const SHOTSTACK_API_URL = 'https://api.shotstack.io/edit/stage'; // Use 'v1' for production

interface ShotstackClip {
  asset: {
    type: 'title' | 'html' | 'image' | 'video' | 'audio';
    [key: string]: unknown;
  };
  start: number;
  length: number;
  transition?: {
    in?: string;
    out?: string;
  };
  effect?: string;
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right';
  offset?: { x: number; y: number };
}

interface ShotstackTimeline {
  background: string;
  tracks: Array<{ clips: ShotstackClip[] }>;
  fonts?: Array<{ src: string }>;
}

interface ShotstackOutput {
  format: 'mp4' | 'gif' | 'jpg' | 'png';
  resolution: 'sd' | 'hd' | '1080' | '4k';
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  fps?: number;
}

interface ShotstackRequest {
  timeline: ShotstackTimeline;
  output: ShotstackOutput;
}

// ============================================
// Job Alert Video Template
// ============================================
export function createJobAlertVideo(params: {
  jobTitle: string;
  companyName: string;
  salary: string | null;
  location: string;
  jobType: string;
}): ShotstackRequest {
  const { jobTitle, companyName, salary, location, jobType } = params;

  return {
    timeline: {
      background: '#0f0f23',
      tracks: [
        // Track 1: Main content (bottom layer)
        {
          clips: [
            // Scene 1: Hook (0-2s)
            {
              asset: {
                type: 'html',
                html: `
                  <div style="font-family: Inter, sans-serif; text-align: center; color: white;">
                    <div style="font-size: 120px; margin-bottom: 20px;">🔥</div>
                    <div style="font-size: 72px; font-weight: 800;">Hot Job Alert!</div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: 'transparent',
              },
              start: 0,
              length: 2,
              transition: { in: 'fade', out: 'fade' },
            },
            // Scene 2: Company + Role (2-5s)
            {
              asset: {
                type: 'html',
                html: `
                  <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
                    <div style="width: 140px; height: 140px; background: rgba(255,255,255,0.15); border-radius: 28px; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center; font-size: 56px; font-weight: 700;">
                      ${companyName.charAt(0)}
                    </div>
                    <div style="font-size: 48px; font-weight: 600; opacity: 0.8; margin-bottom: 10px;">${companyName}</div>
                    <div style="font-size: 36px; opacity: 0.6; margin-bottom: 20px;">is hiring</div>
                    <div style="font-size: 56px; font-weight: 800; line-height: 1.2;">${jobTitle}</div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: 'transparent',
              },
              start: 2,
              length: 3,
              transition: { in: 'slideUp', out: 'fade' },
            },
            // Scene 3: Salary + Location (5-7s)
            {
              asset: {
                type: 'html',
                html: `
                  <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
                    ${salary ? `
                      <div style="font-size: 80px; margin-bottom: 20px;">💰</div>
                      <div style="font-size: 64px; font-weight: 800; color: #4ade80; margin-bottom: 40px;">${salary}</div>
                    ` : ''}
                    <div style="font-size: 60px; margin-bottom: 20px;">📍</div>
                    <div style="font-size: 48px; font-weight: 600; margin-bottom: 30px;">${location}</div>
                    <div style="background: rgba(255,255,255,0.15); padding: 12px 24px; border-radius: 30px; display: inline-block; font-size: 28px; font-weight: 600;">
                      ${jobType}
                    </div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: 'transparent',
              },
              start: 5,
              length: 2,
              transition: { in: 'slideUp', out: 'fade' },
            },
            // Scene 4: CTA (7-8s)
            {
              asset: {
                type: 'html',
                html: `
                  <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
                    <div style="font-size: 64px; font-weight: 800; margin-bottom: 40px;">Apply Now!</div>
                    <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px;">
                      <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: 800;">F</div>
                      <span style="font-size: 36px; font-weight: 700;">Freelanly</span>
                    </div>
                    <div style="font-size: 32px; opacity: 0.8;">freelanly.com</div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: 'transparent',
              },
              start: 7,
              length: 1,
              transition: { in: 'zoom' },
            },
          ],
        },
        // Track 2: Animated gradient background
        {
          clips: [
            {
              asset: {
                type: 'html',
                html: `
                  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%); position: relative; overflow: hidden;">
                    <div style="position: absolute; width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%); top: 20%; left: 20%; filter: blur(60px);"></div>
                    <div style="position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%); bottom: 20%; right: 20%; filter: blur(60px);"></div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: '#0f0f23',
              },
              start: 0,
              length: 8,
            },
          ],
        },
      ],
    },
    output: {
      format: 'mp4',
      resolution: '1080',
      aspectRatio: '9:16',
      fps: 30,
    },
  };
}

// ============================================
// Salary Reveal Video Template
// ============================================
export function createSalaryRevealVideo(params: {
  categoryName: string;
  entryLevel: string | null;
  midLevel: string | null;
  seniorLevel: string | null;
}): ShotstackRequest {
  const { categoryName, entryLevel, midLevel, seniorLevel } = params;

  const scenes: ShotstackClip[] = [];
  let currentTime = 0;

  // Scene 1: Hook
  scenes.push({
    asset: {
      type: 'html',
      html: `
        <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
          <div style="font-size: 100px; margin-bottom: 20px;">💰</div>
          <div style="font-size: 48px; opacity: 0.8; margin-bottom: 10px;">How much do</div>
          <div style="font-size: 56px; font-weight: 800; margin-bottom: 10px;">Remote ${categoryName}</div>
          <div style="font-size: 48px; opacity: 0.8;">make?</div>
        </div>
      `,
      width: 1080,
      height: 1920,
      background: 'transparent',
    },
    start: currentTime,
    length: 2,
    transition: { in: 'fade', out: 'fade' },
  });
  currentTime += 2;

  // Salary levels
  const levels = [
    { label: 'Entry Level', emoji: '🌱', salary: entryLevel, color: '#4ade80' },
    { label: 'Mid Level', emoji: '🚀', salary: midLevel, color: '#60a5fa' },
    { label: 'Senior Level', emoji: '⭐', salary: seniorLevel, color: '#fbbf24' },
  ];

  for (const level of levels) {
    if (level.salary) {
      scenes.push({
        asset: {
          type: 'html',
          html: `
            <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
              <div style="font-size: 80px; margin-bottom: 20px;">${level.emoji}</div>
              <div style="font-size: 42px; opacity: 0.7; margin-bottom: 20px;">${level.label}</div>
              <div style="font-size: 72px; font-weight: 800; color: ${level.color};">${level.salary}</div>
            </div>
          `,
          width: 1080,
          height: 1920,
          background: 'transparent',
        },
        start: currentTime,
        length: 2,
        transition: { in: 'slideUp', out: 'fade' },
      });
      currentTime += 2;
    }
  }

  // CTA
  scenes.push({
    asset: {
      type: 'html',
      html: `
        <div style="font-family: Inter, sans-serif; text-align: center; color: white; padding: 60px;">
          <div style="font-size: 42px; opacity: 0.8; margin-bottom: 20px;">Find your salary at</div>
          <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 20px;">
            <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 35px; font-weight: 800;">F</div>
            <span style="font-size: 42px; font-weight: 700;">Freelanly</span>
          </div>
          <div style="font-size: 36px; font-weight: 600;">freelanly.com</div>
        </div>
      `,
      width: 1080,
      height: 1920,
      background: 'transparent',
    },
    start: currentTime,
    length: 2,
    transition: { in: 'zoom' },
  });
  currentTime += 2;

  return {
    timeline: {
      background: '#0f0f23',
      tracks: [
        { clips: scenes },
        {
          clips: [
            {
              asset: {
                type: 'html',
                html: `
                  <div style="width: 100%; height: 100%; background: linear-gradient(135deg, #0f0f23, #1a1a3e, #0f0f23);">
                    <div style="position: absolute; width: 600px; height: 600px; background: radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%); top: 20%; left: 20%; filter: blur(60px);"></div>
                    <div style="position: absolute; width: 500px; height: 500px; background: radial-gradient(circle, rgba(139,92,246,0.3) 0%, transparent 70%); bottom: 20%; right: 20%; filter: blur(60px);"></div>
                  </div>
                `,
                width: 1080,
                height: 1920,
                background: '#0f0f23',
              },
              start: 0,
              length: currentTime,
            },
          ],
        },
      ],
    },
    output: {
      format: 'mp4',
      resolution: '1080',
      aspectRatio: '9:16',
      fps: 30,
    },
  };
}

// ============================================
// API Functions
// ============================================

export async function renderVideo(template: ShotstackRequest): Promise<{ id: string; status: string }> {
  const response = await fetch(`${SHOTSTACK_API_URL}/render`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': SHOTSTACK_API_KEY,
    },
    body: JSON.stringify(template),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shotstack API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    id: data.response.id,
    status: data.response.status,
  };
}

export async function getVideoStatus(renderId: string): Promise<{
  status: string;
  url: string | null;
  error: string | null;
}> {
  const response = await fetch(`${SHOTSTACK_API_URL}/render/${renderId}`, {
    headers: {
      'x-api-key': SHOTSTACK_API_KEY,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shotstack API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return {
    status: data.response.status,
    url: data.response.url || null,
    error: data.response.error || null,
  };
}

// ============================================
// Helper: Wait for video completion
// ============================================
export async function waitForVideo(
  renderId: string,
  maxWaitMs = 120000,
  pollIntervalMs = 3000
): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getVideoStatus(renderId);

    if (status.status === 'done') {
      if (!status.url) throw new Error('Video completed but no URL returned');
      return status.url;
    }

    if (status.status === 'failed') {
      throw new Error(`Video rendering failed: ${status.error}`);
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error('Video rendering timed out');
}
