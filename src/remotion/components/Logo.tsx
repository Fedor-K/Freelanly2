import { Img, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface LogoProps {
  size?: number;
  delay?: number;
}

// Freelanly animated logo
export const FreelanlayLogo: React.FC<LogoProps> = ({ size = 80, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const opacity = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.2,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.5,
          fontWeight: 800,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        F
      </div>
      <span
        style={{
          fontSize: size * 0.5,
          fontWeight: 700,
          color: 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        Freelanly
      </span>
    </div>
  );
};

// Company logo with fallback
export const CompanyLogo: React.FC<{
  src: string | null;
  name: string;
  size?: number;
  delay?: number;
}> = ({ src, name, size = 120, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayedFrame = Math.max(0, frame - delay);

  const scale = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const opacity = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });

  // Get initials for fallback
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {src ? (
        <Img
          src={src}
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.2,
            objectFit: 'cover',
            backgroundColor: 'white',
          }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: size * 0.2,
            backgroundColor: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.4,
            fontWeight: 700,
            color: 'white',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
};
