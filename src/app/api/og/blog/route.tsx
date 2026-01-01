import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Get parameters
  const title = searchParams.get('title') || 'Blog Post';
  const category = searchParams.get('category') || 'Article';
  const author = searchParams.get('author') || 'Freelanly Team';
  const readTime = searchParams.get('readTime') || '5';

  // Category colors
  const categoryColors: Record<string, { bg: string; text: string }> = {
    'Salary Guides': { bg: '#fef3c7', text: '#92400e' },
    'Remote Job Hunting': { bg: '#dbeafe', text: '#1e40af' },
    'Remote Work Tips': { bg: '#dcfce7', text: '#166534' },
    'Company Spotlights': { bg: '#f3e8ff', text: '#7c3aed' },
    'Digital Nomad': { bg: '#fce7f3', text: '#be185d' },
    'Industry Reports': { bg: '#e0e7ff', text: '#4338ca' },
  };

  const colors = categoryColors[category] || { bg: '#f3f4f6', text: '#374151' };

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
              Freelanly Blog
            </span>
          </div>

          {/* Category badge */}
          <div
            style={{
              backgroundColor: colors.bg,
              padding: '10px 20px',
              borderRadius: '24px',
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
            }}
          >
            {category}
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {/* Title */}
          <h1
            style={{
              fontSize: title.length > 50 ? '44px' : title.length > 30 ? '52px' : '60px',
              fontWeight: 'bold',
              color: '#111827',
              lineHeight: 1.2,
              marginBottom: '24px',
              maxWidth: '950px',
            }}
          >
            {title.length > 80 ? title.slice(0, 77) + '...' : title}
          </h1>

          {/* Meta info */}
          <div
            style={{
              display: 'flex',
              gap: '32px',
              marginTop: 'auto',
              marginBottom: '20px',
            }}
          >
            {/* Author */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '22px',
                color: '#4b5563',
              }}
            >
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '20px',
                  backgroundColor: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                }}
              >
                ✍️
              </div>
              <span>{author}</span>
            </div>

            {/* Read time */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '22px',
                color: '#4b5563',
              }}
            >
              <span>⏱️</span>
              <span>{readTime} min read</span>
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
            freelanly.com/blog
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
            Read More →
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
