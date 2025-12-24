import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Freelanly - Remote Jobs Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          padding: '60px',
        }}
      >
        {/* Top bar with branding */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '32px',
                fontWeight: 'bold',
              }}
            >
              F
            </div>
            <span style={{ fontSize: '36px', fontWeight: '700', color: '#1f2937' }}>
              Freelanly
            </span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              color: '#111827',
              lineHeight: 1.1,
              marginBottom: '24px',
            }}
          >
            Find Your Next
            <br />
            <span style={{ color: '#6366f1' }}>Remote Job</span>
          </h1>

          <p
            style={{
              fontSize: '28px',
              color: '#6b7280',
              marginBottom: '40px',
            }}
          >
            1000+ remote positions from top companies worldwide
          </p>

          {/* Stats */}
          <div
            style={{
              display: 'flex',
              gap: '48px',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#111827' }}>1000+</span>
              <span style={{ fontSize: '18px', color: '#6b7280' }}>Remote Jobs</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#111827' }}>500+</span>
              <span style={{ fontSize: '18px', color: '#6b7280' }}>Companies</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '40px', fontWeight: 'bold', color: '#111827' }}>21</span>
              <span style={{ fontSize: '18px', color: '#6b7280' }}>Categories</span>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '2px solid #e5e7eb',
            paddingTop: '24px',
          }}
        >
          <span style={{ fontSize: '20px', color: '#9ca3af' }}>
            freelanly.com
          </span>
          <div
            style={{
              backgroundColor: '#6366f1',
              color: 'white',
              padding: '14px 28px',
              borderRadius: '8px',
              fontSize: '20px',
              fontWeight: '600',
            }}
          >
            Browse Jobs →
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
