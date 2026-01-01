// Remotion entry point
import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

// Register the root component
registerRoot(RemotionRoot);

// Re-export for use in other parts of the app
export { RemotionRoot } from './Root';

// Compositions
export { JobAlertVideo, jobAlertSchema } from './compositions/JobAlertVideo';
export { SalaryRevealVideo, salaryRevealSchema } from './compositions/SalaryRevealVideo';
export { TopJobsVideo, topJobsSchema } from './compositions/TopJobsVideo';

// Components
export { Background, OrbsBackground } from './components/Background';
export { AnimatedText, TypewriterText, AnimatedNumber } from './components/AnimatedText';
export { FreelanlayLogo, CompanyLogo } from './components/Logo';
