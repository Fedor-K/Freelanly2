import { Composition } from 'remotion';
import { JobAlertVideo, jobAlertSchema } from './compositions/JobAlertVideo';
import { SalaryRevealVideo, salaryRevealSchema } from './compositions/SalaryRevealVideo';
import { TopJobsVideo, topJobsSchema } from './compositions/TopJobsVideo';

// Video dimensions for social media
const VERTICAL = { width: 1080, height: 1920 }; // TikTok, Reels, Shorts
const SQUARE = { width: 1080, height: 1080 };   // Instagram Feed
const HORIZONTAL = { width: 1920, height: 1080 }; // YouTube

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Job Alert Video - 8 seconds */}
      <Composition
        id="JobAlert"
        component={JobAlertVideo}
        durationInFrames={240} // 8 sec @ 30fps
        fps={30}
        {...VERTICAL}
        schema={jobAlertSchema}
        defaultProps={{
          jobTitle: 'Senior React Developer',
          companyName: 'Acme Inc',
          companyLogo: null,
          salary: '$120K - $180K/year',
          location: 'Remote - USA',
          jobType: 'Full-time',
        }}
      />

      {/* Salary Reveal Video - 10 seconds */}
      <Composition
        id="SalaryReveal"
        component={SalaryRevealVideo}
        durationInFrames={300} // 10 sec @ 30fps
        fps={30}
        {...VERTICAL}
        schema={salaryRevealSchema}
        defaultProps={{
          categoryName: 'Software Engineers',
          entryLevel: '$60K - $80K',
          midLevel: '$90K - $130K',
          seniorLevel: '$140K - $200K',
        }}
      />

      {/* Top Jobs Video - 15 seconds */}
      <Composition
        id="TopJobs"
        component={TopJobsVideo}
        durationInFrames={450} // 15 sec @ 30fps
        fps={30}
        {...VERTICAL}
        schema={topJobsSchema}
        defaultProps={{
          jobs: [
            { title: 'Staff Engineer', company: 'Stripe', salary: '$250K' },
            { title: 'Engineering Manager', company: 'Notion', salary: '$220K' },
            { title: 'Principal Developer', company: 'Figma', salary: '$200K' },
          ],
        }}
      />

      {/* Square versions for Instagram */}
      <Composition
        id="JobAlert-Square"
        component={JobAlertVideo}
        durationInFrames={240}
        fps={30}
        {...SQUARE}
        schema={jobAlertSchema}
        defaultProps={{
          jobTitle: 'Senior React Developer',
          companyName: 'Acme Inc',
          companyLogo: null,
          salary: '$120K - $180K/year',
          location: 'Remote - USA',
          jobType: 'Full-time',
        }}
      />
    </>
  );
};
