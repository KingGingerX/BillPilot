import cron from "node-cron";
import { runScout } from "../recruitment/scout";
import { config } from "../config";
import { logger } from "../utils/logger";

export function startScoutJob(): void {
  cron.schedule(config.cron.scout, async () => {
    logger.info("[job/scout] starting daily scout run");
    try {
      const found = await runScout();
      logger.info(`[job/scout] found ${found} new prospects`);
    } catch (err) {
      logger.error("[job/scout] error:", err);
    }
  });
  logger.info(`[job/scout] scheduled: ${config.cron.scout}`);
}
