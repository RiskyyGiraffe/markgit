import { runDueJobs, schedulePayoutSweep } from './services/jobs.js';
import { expireOverdueHarnessRuns } from './services/harness-runs.js';

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
      const expiredHarnessRuns = await expireOverdueHarnessRuns();
      if (results.length > 0) {
        console.log('[worker] processed:', JSON.stringify(results));
      }
      if (expiredHarnessRuns.length > 0) {
        console.log('[worker] expired harness runs:', JSON.stringify(expiredHarnessRuns));
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
