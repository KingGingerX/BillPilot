/**
 * Bull queue factory and worker initialization.
 * Connects to Redis and creates named queues for background work.
 */
import Bull from "bull";
import { config } from "../config";
import { logger } from "../utils/logger";

const redisConfig = {
  redis: {
    host: new URL(config.redis.url).hostname,
    port: parseInt(new URL(config.redis.url).port, 10) || 6379,
    password: config.redis.password || undefined,
  },
};

// ── Queue definitions ─────────────────────────────────────────

export const contentQueue = new Bull("content-publishing", redisConfig);
export const analyticsQueue = new Bull("analytics-snapshots", redisConfig);
export const payoutQueue = new Bull("affiliate-payouts", redisConfig);

// ── Error logging for all queues ──────────────────────────────

[contentQueue, analyticsQueue, payoutQueue].forEach((queue) => {
  queue.on("error", (err) => logger.error(`Queue error [${queue.name}]`, { err }));
  queue.on("failed", (job, err) =>
    logger.warn(`Job failed [${queue.name}:${job.id}]`, { err })
  );
  queue.on("completed", (job) =>
    logger.debug(`Job completed [${queue.name}:${job.id}]`)
  );
});

export async function startWorkers() {
  const { processContentQueue } = await import("./content.job");
  const { processAnalyticsQueue } = await import("./payout.job");

  processContentQueue();
  processAnalyticsQueue();

  logger.info("Background job workers started");
}
