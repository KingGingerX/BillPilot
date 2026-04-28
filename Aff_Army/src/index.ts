import "./config"; // load env vars first
import { config } from "./config";
import { logger } from "./utils/logger";
import { prisma } from "./db/client";
import app from "./api/server";
import { startScoutJob } from "./jobs/scout.job";
import { startOutreachJob } from "./jobs/outreach.job";
import { startPayoutJob } from "./jobs/payout.job";

async function main() {
  // Verify DB connectivity
  await prisma.$connect();
  logger.info("[boot] database connected");

  // Start background jobs
  startScoutJob();
  startOutreachJob();
  startPayoutJob();

  // Start HTTP server
  app.listen(config.port, () => {
    logger.info(`[boot] AffArmy running on :${config.port}`);
    logger.info(`[boot] Dashboard: http://localhost:${config.port}/dashboard`);
    logger.info(`[boot] Tracking:  http://localhost:${config.port}/track/click/:code`);
  });
}

main().catch((err) => {
  logger.error("[boot] fatal error:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  logger.info("[boot] shutting down...");
  await prisma.$disconnect();
  process.exit(0);
});
