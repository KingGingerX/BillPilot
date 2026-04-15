/**
 * Express application setup.
 * All middleware, routes, and error handlers are registered here.
 * The Stripe webhook route MUST be registered before express.json()
 * so it receives the raw body for signature verification.
 */
import "express-async-errors"; // Patches express to forward async errors to error handler
import express, { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import compression from "compression";
import cookieParser from "cookie-parser";

import { config } from "./config";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { apiLimiter } from "./middleware/rateLimiter";

// Route modules
import authRoutes from "./modules/auth/auth.routes";
import productRoutes from "./modules/products/products.routes";
import subscriptionRoutes from "./modules/subscriptions/subscriptions.routes";
import affiliateRoutes from "./modules/affiliates/affiliates.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import contentRoutes from "./modules/content/content.routes";
import webhookRoutes from "./modules/webhooks/webhooks.routes";

export function createApp(): Application {
  const app = express();

  // ── Security ────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd(),
      crossOriginEmbedderPolicy: config.isProd(),
    })
  );

  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ── Stripe webhook MUST come BEFORE express.json() ──────────
  app.use("/api/webhooks", webhookRoutes);

  // ── Body parsing ────────────────────────────────────────────
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app.use(cookieParser());

  // ── Performance ─────────────────────────────────────────────
  app.use(compression());

  // ── Logging ─────────────────────────────────────────────────
  app.use(
    morgan(config.isDev() ? "dev" : "combined", {
      stream: { write: (msg) => logger.http(msg.trim()) },
    })
  );

  // ── Global rate limit ────────────────────────────────────────
  app.use("/api", apiLimiter);

  // ── Trust proxy (for accurate IPs behind nginx) ──────────────
  app.set("trust proxy", 1);

  // ── Health check ─────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // ── API routes ───────────────────────────────────────────────
  app.use("/api/auth",          authRoutes);
  app.use("/api/products",      productRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  app.use("/api/affiliates",    affiliateRoutes);
  app.use("/api/analytics",     analyticsRoutes);
  app.use("/api/content",       contentRoutes);

  // ── 404 handler ──────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: "Route not found" });
  });

  // ── Global error handler ─────────────────────────────────────
  app.use(errorHandler);

  return app;
}
