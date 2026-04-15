/**
 * Analytics snapshot job — creates a daily revenue snapshot at midnight.
 * Also re-exports processAnalyticsQueue for the queue startup.
 */
import { analyticsQueue } from "./queue";
import { createDailySnapshot } from "../modules/analytics/analytics.service";
import { logger } from "../utils/logger";

/** Schedule: run at midnight UTC every day */
function msUntilMidnightUTC(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0); // next midnight UTC
  return midnight.getTime() - now.getTime();
}

export function processAnalyticsQueue(): void {
  // Worker
  analyticsQueue.process(async (job) => {
    const { date } = job.data as { date: string };
    logger.info(`Creating daily revenue snapshot for ${date}`);
    await createDailySnapshot(new Date(date));
  });

  // Scheduler: fire at the next midnight then every 24h
  const scheduleNext = () => {
    const delay = msUntilMidnightUTC();
    setTimeout(async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      await analyticsQueue.add(
        { date: yesterday.toISOString().slice(0, 10) },
        { attempts: 3, backoff: { type: "fixed", delay: 60_000 } }
      );
      logger.info("Daily analytics snapshot job queued");
      scheduleNext(); // Schedule next day
    }, delay);
  };

  scheduleNext();
  logger.info(`Analytics snapshot scheduled in ${Math.round(msUntilMidnightUTC() / 1000 / 60)} minutes`);
}
