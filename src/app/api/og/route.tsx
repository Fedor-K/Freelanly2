import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Get parameters
  const title = searchParams.get('title') || 'Remote Job';
  const company = searchParams.get('company') || '';
  const salary = searchParams.get('salary') || '';
  const location = searchParams.get('location') || 'Remote';
  const category = searchParams.get('category') || '';
  const type = searchParams.get('type') || 'job'; // job, company, category

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
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: 'bold',
              }}
            >
              F
            </div>
            <span style={{ fontSize: '28px', fontWeight: '600', color: '#1f2937' }}>
              Freelanly
            </span>
          </div>
          {category && (
            <div
              style={{
                backgroundColor: '#f3f4f6',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '18px',
                color: '#6b7280',
              }}
            >
              {category}
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 40 ? '48px' : '56px',
              fontWeight: 'bold',
              color: '#111827',
              lineHeight: 1.2,
              marginBottom: '20px',
              maxWidth: '900px',
            }}
          >
            {title.length > 60 ? title.slice(0, 57) + '...' : title}
          </h1>

          {/* Company name */}
          {company && type === 'job' && (
            <p
              style={{
                fontSize: '32px',
                color: '#6366f1',
                marginBottom: '24px',
              }}
            >
              at {company}
            </p>
          )}

          {/* Meta info row */}
          <div
            style={{
              display: 'flex',
              gap: '24px',
              marginTop: 'auto',
              marginBottom: '20px',
            }}
          >
            {/* Location */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '24px',
                color: '#4b5563',
              }}
            >
              <span>📍</span>
              <span>{location}</span>
            </div>

            {/* Salary */}
            {salary && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '24px',
                  color: '#059669',
                  fontWeight: '600',
                }}
              >
                <span>💰</span>
                <span>{salary}</span>
              </div>
            )}
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
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '20px',
              fontWeight: '600',
            }}
          >
            {type === 'job' ? 'Apply Now →' : 'View Jobs →'}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    }
  );
}
