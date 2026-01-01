import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface AnimatedTextProps {
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  style?: React.CSSProperties;
  animation?: 'fadeUp' | 'fadeIn' | 'typewriter' | 'scale';
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  delay = 0,
  fontSize = 48,
  color = 'white',
  fontWeight = 700,
  style = {},
  animation = 'fadeUp',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayedFrame = Math.max(0, frame - delay);

  let opacity = 1;
  let translateY = 0;
  let scale = 1;

  if (animation === 'fadeUp') {
    opacity = spring({
      frame: delayedFrame,
      fps,
      config: { damping: 20, stiffness: 100 },
    });
    translateY = interpolate(
      spring({ frame: delayedFrame, fps, config: { damping: 20, stiffness: 100 } }),
      [0, 1],
      [40, 0]
    );
  }

  if (animation === 'fadeIn') {
    opacity = spring({
      frame: delayedFrame,
      fps,
      config: { damping: 20, stiffness: 80 },
    });
  }

  if (animation === 'scale') {
    scale = spring({
      frame: delayedFrame,
      fps,
      config: { damping: 15, stiffness: 150 },
    });
    opacity = spring({
      frame: delayedFrame,
      fps,
      config: { damping: 20, stiffness: 100 },
    });
  }

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        opacity,
        transform: `translateY(${translateY}px) scale(${scale})`,
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        lineHeight: 1.2,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

// Typewriter effect for longer text
export const TypewriterText: React.FC<{
  text: string;
  delay?: number;
  fontSize?: number;
  color?: string;
  charsPerFrame?: number;
}> = ({ text, delay = 0, fontSize = 32, color = 'white', charsPerFrame = 0.5 }) => {
  const frame = useCurrentFrame();
  const delayedFrame = Math.max(0, frame - delay);

  const charsToShow = Math.floor(delayedFrame * charsPerFrame);
  const displayText = text.slice(0, charsToShow);

  return (
    <div
      style={{
        fontSize,
        fontWeight: 600,
        color,
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      {displayText}
      {charsToShow < text.length && (
        <span style={{ opacity: frame % 20 < 10 ? 1 : 0 }}>|</span>
      )}
    </div>
  );
};

// Counter animation for numbers
export const AnimatedNumber: React.FC<{
  value: number;
  delay?: number;
  fontSize?: number;
  color?: string;
  prefix?: string;
  suffix?: string;
}> = ({ value, delay = 0, fontSize = 64, color = 'white', prefix = '', suffix = '' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const delayedFrame = Math.max(0, frame - delay);

  const progress = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 30, stiffness: 80 },
  });

  const displayValue = Math.round(value * progress);

  return (
    <div
      style={{
        fontSize,
        fontWeight: 800,
        color,
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </div>
  );
};
