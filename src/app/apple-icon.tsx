import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          borderRadius: '40px',
        }}
      >
        <span
          style={{
            fontSize: '100px',
            fontWeight: 'bold',
            color: 'white',
          }}
        >
          F
        </span>
      </div>
    ),
    { ...size }
  );
}
