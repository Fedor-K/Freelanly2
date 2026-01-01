import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';

interface BackgroundProps {
  variant?: 'gradient' | 'solid' | 'animated';
  colors?: [string, string];
}

export const Background: React.FC<BackgroundProps> = ({
  variant = 'gradient',
  colors = ['#6366f1', '#8b5cf6'],
}) => {
  const frame = useCurrentFrame();

  if (variant === 'animated') {
    const rotation = interpolate(frame, [0, 300], [0, 360]);
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(${rotation}deg, ${colors[0]}, ${colors[1]})`,
        }}
      />
    );
  }

  if (variant === 'gradient') {
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`,
        }}
      />
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors[0],
      }}
    />
  );
};

// Animated gradient orbs background
export const OrbsBackground: React.FC = () => {
  const frame = useCurrentFrame();

  const orb1X = interpolate(frame, [0, 150, 300], [20, 80, 20], {
    extrapolateRight: 'clamp',
  });
  const orb2X = interpolate(frame, [0, 150, 300], [70, 30, 70], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0f0f23' }}>
      {/* Gradient orbs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)',
          left: `${orb1X}%`,
          top: '20%',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)',
          left: `${orb2X}%`,
          top: '70%',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(60px)',
        }}
      />
    </AbsoluteFill>
  );
};
