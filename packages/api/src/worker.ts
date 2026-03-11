import { runDueJobs, schedulePayoutSweep } from './services/jobs.js';

async function bootstrap() {
  console.log('[worker] starting');

  try {
    await schedulePayoutSweep();
  } catch (error) {
    console.error('[worker] failed to schedule payout sweep:', error);
  }

  const intervalMs = 60_000;
  setInterval(async () => {
    try {
      const results = await runDueJobs();
      if (results.length > 0) {
        console.log('[worker] processed:', JSON.stringify(results));
      }
    } catch (error) {
      console.error('[worker] failure:', error);
    }
  }, intervalMs);
}

bootstrap().catch((error) => {
  console.error('[worker] fatal error:', error);
  process.exit(1);
});
