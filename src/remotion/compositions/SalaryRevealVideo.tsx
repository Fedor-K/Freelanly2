import { z } from 'zod';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { OrbsBackground } from '../components/Background';
import { AnimatedText, AnimatedNumber } from '../components/AnimatedText';
import { FreelanlayLogo } from '../components/Logo';

// Schema for input validation
export const salaryRevealSchema = z.object({
  categoryName: z.string(),
  entryLevel: z.string().nullable(),
  midLevel: z.string().nullable(),
  seniorLevel: z.string().nullable(),
});

type SalaryRevealProps = z.infer<typeof salaryRevealSchema>;

export const SalaryRevealVideo: React.FC<SalaryRevealProps> = ({
  categoryName,
  entryLevel,
  midLevel,
  seniorLevel,
}) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;
  const padding = isVertical ? 60 : 80;

  return (
    <AbsoluteFill>
      <OrbsBackground />

      {/* Scene 1: Hook (frames 0-60, 0-2 sec) */}
      <Sequence from={0} durationInFrames={60}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding,
            gap: 20,
          }}
        >
          <AnimatedText
            text="💰"
            fontSize={isVertical ? 100 : 80}
            animation="scale"
            delay={0}
          />
          <AnimatedText
            text="How much do"
            fontSize={isVertical ? 48 : 42}
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={10}
          />
          <AnimatedText
            text={`Remote ${categoryName}`}
            fontSize={isVertical ? 56 : 48}
            fontWeight={800}
            animation="fadeUp"
            delay={20}
          />
          <AnimatedText
            text="make?"
            fontSize={isVertical ? 48 : 42}
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={30}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Entry Level (frames 60-120, 2-4 sec) */}
      {entryLevel && (
        <Sequence from={60} durationInFrames={60}>
          <SalaryLevel
            level="Entry Level"
            emoji="🌱"
            salary={entryLevel}
            color="#4ade80"
            isVertical={isVertical}
            padding={padding}
          />
        </Sequence>
      )}

      {/* Scene 3: Mid Level (frames 120-180, 4-6 sec) */}
      {midLevel && (
        <Sequence from={120} durationInFrames={60}>
          <SalaryLevel
            level="Mid Level"
            emoji="🚀"
            salary={midLevel}
            color="#60a5fa"
            isVertical={isVertical}
            padding={padding}
          />
        </Sequence>
      )}

      {/* Scene 4: Senior Level (frames 180-240, 6-8 sec) */}
      {seniorLevel && (
        <Sequence from={180} durationInFrames={60}>
          <SalaryLevel
            level="Senior Level"
            emoji="⭐"
            salary={seniorLevel}
            color="#fbbf24"
            isVertical={isVertical}
            padding={padding}
          />
        </Sequence>
      )}

      {/* Scene 5: CTA (frames 240-300, 8-10 sec) */}
      <Sequence from={240} durationInFrames={60}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding,
            gap: 30,
          }}
        >
          <AnimatedText
            text="Find your salary at"
            fontSize={isVertical ? 42 : 36}
            fontWeight={500}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={0}
          />
          <FreelanlayLogo size={isVertical ? 70 : 60} delay={10} />
          <AnimatedText
            text="freelanly.com"
            fontSize={isVertical ? 48 : 42}
            fontWeight={700}
            animation="fadeUp"
            delay={20}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// Helper component for salary level display
const SalaryLevel: React.FC<{
  level: string;
  emoji: string;
  salary: string;
  color: string;
  isVertical: boolean;
  padding: number;
}> = ({ level, emoji, salary, color, isVertical, padding }) => {
  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        gap: 20,
      }}
    >
      <AnimatedText
        text={emoji}
        fontSize={isVertical ? 80 : 64}
        animation="scale"
        delay={0}
      />
      <AnimatedText
        text={level}
        fontSize={isVertical ? 42 : 36}
        fontWeight={600}
        color="rgba(255,255,255,0.7)"
        animation="fadeUp"
        delay={10}
      />
      <AnimatedText
        text={salary}
        fontSize={isVertical ? 72 : 60}
        fontWeight={800}
        color={color}
        animation="scale"
        delay={20}
      />
    </AbsoluteFill>
  );
};
