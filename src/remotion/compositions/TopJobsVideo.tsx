import { z } from 'zod';
import { AbsoluteFill, Sequence, useVideoConfig, spring, useCurrentFrame } from 'remotion';
import { OrbsBackground } from '../components/Background';
import { AnimatedText } from '../components/AnimatedText';
import { FreelanlayLogo } from '../components/Logo';

// Schema for input validation
export const topJobsSchema = z.object({
  jobs: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      salary: z.string(),
    })
  ),
});

type TopJobsProps = z.infer<typeof topJobsSchema>;

export const TopJobsVideo: React.FC<TopJobsProps> = ({ jobs }) => {
  const { width, height } = useVideoConfig();
  const isVertical = height > width;
  const padding = isVertical ? 60 : 80;

  const jobCount = Math.min(jobs.length, 5);
  const framesPerJob = 70; // ~2.3 sec per job

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
            text="🏆"
            fontSize={isVertical ? 100 : 80}
            animation="scale"
            delay={0}
          />
          <AnimatedText
            text={`Top ${jobCount}`}
            fontSize={isVertical ? 72 : 64}
            fontWeight={800}
            animation="fadeUp"
            delay={10}
          />
          <AnimatedText
            text="Highest Paying"
            fontSize={isVertical ? 48 : 42}
            fontWeight={600}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={20}
          />
          <AnimatedText
            text="Remote Jobs!"
            fontSize={isVertical ? 56 : 48}
            fontWeight={700}
            color="#fbbf24"
            animation="fadeUp"
            delay={30}
          />
        </AbsoluteFill>
      </Sequence>

      {/* Job Scenes */}
      {jobs.slice(0, 5).map((job, index) => (
        <Sequence
          key={index}
          from={60 + index * framesPerJob}
          durationInFrames={framesPerJob}
        >
          <JobCard
            rank={index + 1}
            title={job.title}
            company={job.company}
            salary={job.salary}
            isVertical={isVertical}
            padding={padding}
          />
        </Sequence>
      ))}

      {/* CTA Scene */}
      <Sequence from={60 + jobCount * framesPerJob} durationInFrames={60}>
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
          <FreelanlayLogo size={isVertical ? 70 : 60} delay={10} />
          <AnimatedText
            text="freelanly.com"
            fontSize={isVertical ? 42 : 36}
            fontWeight={600}
            color="rgba(255,255,255,0.8)"
            animation="fadeUp"
            delay={20}
          />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};

// Helper component for job card
const JobCard: React.FC<{
  rank: number;
  title: string;
  company: string;
  salary: string;
  isVertical: boolean;
  padding: number;
}> = ({ rank, title, company, salary, isVertical, padding }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 150 },
  });

  const rankColors = ['#fbbf24', '#94a3b8', '#cd7c32', '#6366f1', '#8b5cf6'];
  const rankColor = rankColors[rank - 1] || '#6366f1';

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding,
        gap: 25,
      }}
    >
      {/* Rank badge */}
      <div
        style={{
          transform: `scale(${scale})`,
          width: isVertical ? 100 : 80,
          height: isVertical ? 100 : 80,
          borderRadius: '50%',
          backgroundColor: rankColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isVertical ? 48 : 40,
          fontWeight: 800,
          color: rank <= 2 ? '#1f2937' : 'white',
          fontFamily: 'Inter, system-ui, sans-serif',
          boxShadow: `0 0 40px ${rankColor}40`,
        }}
      >
        #{rank}
      </div>

      <AnimatedText
        text={title}
        fontSize={isVertical ? 52 : 44}
        fontWeight={800}
        animation="fadeUp"
        delay={10}
        style={{ textAlign: 'center', maxWidth: '90%' }}
      />

      <AnimatedText
        text={`at ${company}`}
        fontSize={isVertical ? 36 : 32}
        fontWeight={500}
        color="rgba(255,255,255,0.7)"
        animation="fadeUp"
        delay={20}
      />

      <AnimatedText
        text={salary}
        fontSize={isVertical ? 64 : 56}
        fontWeight={800}
        color="#4ade80"
        animation="scale"
        delay={30}
      />
    </AbsoluteFill>
  );
};
