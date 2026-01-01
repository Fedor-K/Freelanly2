import { z } from 'zod';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from 'remotion';
import { OrbsBackground } from '../components/Background';
import { AnimatedText } from '../components/AnimatedText';
import { FreelanlayLogo, CompanyLogo } from '../components/Logo';

// Schema for input validation
export const jobAlertSchema = z.object({
  jobTitle: z.string(),
  companyName: z.string(),
  companyLogo: z.string().nullable(),
  salary: z.string().nullable(),
  location: z.string(),
  jobType: z.string(),
});

type JobAlertProps = z.infer<typeof jobAlertSchema>;

export const JobAlertVideo: React.FC<JobAlertProps> = ({
  jobTitle,
  companyName,
  companyLogo,
  salary,
  location,
  jobType,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  // Determine if vertical or square
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
          }}
        >
          <AnimatedText
            text="🔥"
            fontSize={isVertical ? 120 : 100}
            animation="scale"
            delay={0}
          />
          <AnimatedText
            text="Hot Job Alert!"
            fontSize={isVertical ? 72 : 64}
            fontWeight={800}
            animation="fadeUp"
            delay={10}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 2: Company + Role (frames 60-150, 2-5 sec) */}
      <Sequence from={60} durationInFrames={90}>
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
          <CompanyLogo
            src={companyLogo}
            name={companyName}
            size={isVertical ? 140 : 120}
            delay={0}
          />
          <AnimatedText
            text={companyName}
            fontSize={isVertical ? 48 : 42}
            fontWeight={600}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={10}
          />
          <AnimatedText
            text="is hiring"
            fontSize={isVertical ? 36 : 32}
            fontWeight={400}
            color="rgba(255,255,255,0.6)"
            animation="fadeUp"
            delay={20}
          />
          <AnimatedText
            text={jobTitle}
            fontSize={isVertical ? 56 : 48}
            fontWeight={800}
            animation="fadeUp"
            delay={30}
            style={{ maxWidth: width - padding * 2, textAlign: 'center' }}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 3: Salary + Location (frames 150-210, 5-7 sec) */}
      <Sequence from={150} durationInFrames={60}>
        <AbsoluteFill
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding,
            gap: 40,
          }}
        >
          {salary && (
            <div style={{ textAlign: 'center' }}>
              <AnimatedText
                text="💰"
                fontSize={isVertical ? 80 : 64}
                animation="scale"
                delay={0}
              />
              <AnimatedText
                text={salary}
                fontSize={isVertical ? 64 : 56}
                fontWeight={800}
                color="#4ade80"
                animation="fadeUp"
                delay={10}
              />
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <AnimatedText
              text="📍"
              fontSize={isVertical ? 60 : 48}
              animation="scale"
              delay={20}
            />
            <AnimatedText
              text={location}
              fontSize={isVertical ? 48 : 40}
              fontWeight={600}
              animation="fadeUp"
              delay={30}
            />
          </div>
          <Pill text={jobType} delay={40} />
        </AbsoluteFill>
      </Sequence>

      {/* Scene 4: CTA (frames 210-240, 7-8 sec) */}
      <Sequence from={210} durationInFrames={30}>
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
            text="Apply Now!"
            fontSize={isVertical ? 64 : 56}
            fontWeight={800}
            animation="scale"
            delay={0}
          />
          <FreelanlayLogo size={isVertical ? 60 : 50} delay={10} />
          <AnimatedText
            text="freelanly.com"
            fontSize={isVertical ? 36 : 32}
            fontWeight={600}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={15}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// Helper component for job type pill
const Pill: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
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
        opacity,
        transform: `scale(${scale})`,
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: '12px 24px',
        borderRadius: 30,
        fontSize: 28,
        fontWeight: 600,
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {text}
    </div>
  );
};
