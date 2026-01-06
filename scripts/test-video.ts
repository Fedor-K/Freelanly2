import { prisma } from '../src/lib/db';

async function testVideoGeneration() {
  // Get the pending item with job data
  const item = await prisma.videoPostQueue.findFirst({
    where: { status: 'PENDING' },
    include: {
      job: {
        include: { company: true }
      }
    },
  });

  if (!item || !item.job) {
    console.log('No pending items');
    return null;
  }

  const job = item.job;
  const company = job.company;

  console.log('Queue item ID:', item.id);
  console.log('Job:', job.title, 'at', company.name);

  // Generate salary text
  let salaryTTS = '';
  if (job.salaryMin || job.salaryMax) {
    const formatSalary = (n: number) => n >= 1000 ? Math.round(n/1000) + 'k' : String(n);
    if (job.salaryMin && job.salaryMax) {
      salaryTTS = `Salary range: ${formatSalary(job.salaryMin)} to ${formatSalary(job.salaryMax)} dollars.`;
    } else if (job.salaryMin) {
      salaryTTS = `Starting at ${formatSalary(job.salaryMin)} dollars.`;
    }
  }

  // Generate location
  const location = job.location ? `Location: ${job.location.split(',')[0]}.` : 'Remote position.';

  // TTS text
  const ttsText = `Hot job alert! ${company.name} is hiring a ${job.title}. ${salaryTTS} ${location} Apply now at freelan-lee dot com!`;

  // Caption
  const captionText = `${job.title} at ${company.name}`;

  // Background search terms
  const categoryBackgrounds: Record<string, string> = {
    'translation': 'person translating documents',
    'writing': 'person writing on laptop',
    'engineering': 'software developer coding',
    'design': 'graphic designer working',
    'marketing': 'marketing team meeting',
    'data': 'data analyst charts',
  };
  const background = categoryBackgrounds[job.category] || 'professional office work';

  const script = {
    scenes: [{
      text: ttsText,
      caption: captionText,
      searchTerms: [background, 'typing keyboard fast technology'],
    }],
    config: {
      voice: 'af_heart',
      music: 'hopeful',
      captionPosition: 'bottom',
      orientation: 'portrait',
      musicVolume: 'low',
    },
  };

  console.log('\nVideo script:');
  console.log(JSON.stringify(script, null, 2));

  // Test VPS video service
  console.log('\n--- Testing VPS video service ---');

  try {
    const response = await fetch('http://198.12.73.168:3123/api/short-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(script),
    });

    const result = await response.json();
    console.log('VPS response:', result);

    if (result.videoId) {
      console.log('\nVideo creation started! ID:', result.videoId);
      console.log('Polling for completion...');

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes max

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 10000)); // 10 sec
        attempts++;

        const statusRes = await fetch(`http://198.12.73.168:3123/api/short-video/${result.videoId}`);
        const status = await statusRes.json();

        console.log(`[${attempts}] Status: ${status.status}`);

        if (status.status === 'ready') {
          console.log('\n✅ Video ready!');
          console.log('Video URL:', status.videoUrl);

          // Mark as posted in queue
          await prisma.videoPostQueue.update({
            where: { id: item.id },
            data: {
              status: 'POSTED',
              postedAt: new Date(),
              videoId: result.videoId,
              videoUrl: status.videoUrl,
            },
          });
          console.log('Queue item marked as POSTED');
          return;
        } else if (status.status === 'error') {
          console.log('\n❌ Video generation failed:', status.error);

          await prisma.videoPostQueue.update({
            where: { id: item.id },
            data: {
              status: 'FAILED',
              error: status.error || 'Video generation failed',
            },
          });
          return;
        }
      }

      console.log('\n⏰ Timeout waiting for video');
    }
  } catch (error) {
    console.error('VPS request failed:', error);
  }
}

testVideoGeneration()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
