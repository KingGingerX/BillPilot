import cron from "node-cron";
import { processOutreachQueue } from "../outreach/sequences";
import { config } from "../config";
import { logger } from "../utils/logger";

export function startOutreachJob(): void {
  cron.schedule(config.cron.outreach, async () => {
    logger.info("[job/outreach] processing outreach queue");
    try {
      await processOutreachQueue();
    } catch (err) {
      logger.error("[job/outreach] error:", err);
    }
  });
  logger.info(`[job/outreach] scheduled: ${config.cron.outreach}`);
}
