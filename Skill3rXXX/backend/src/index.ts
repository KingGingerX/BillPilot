/**
 * PIMS Backend — Application entry point.
 * Validates config, starts the HTTP server, and launches background workers.
 */
import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./utils/logger";
import { startWorkers } from "./jobs/queue";

async function bootstrap() {
  try {
    const app = createApp();

    const server = app.listen(config.port, () => {
      logger.info(`🚀 PIMS API running on port ${config.port} [${config.env}]`);
    });

    // Start background job workers (content publishing, analytics snapshots)
    await startWorkers();

    // ── Graceful shutdown ──────────────────────────────────────
    const shutdown = (signal: string) => {
      logger.info(`${signal} received — shutting down gracefully`);
      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
      // Force exit if graceful shutdown takes too long
      setTimeout(() => process.exit(1), 10_000);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));
    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception", { err });
      process.exit(1);
    });
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection", { reason });
    });
  } catch (err) {
    logger.error("Failed to start server", { err });
    process.exit(1);
  }
}

bootstrap();
