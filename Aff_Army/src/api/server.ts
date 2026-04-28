import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { config } from "../config";

import trackingRoutes from "./routes/tracking";
import affiliateRoutes from "./routes/affiliates";
import analyticsRoutes from "./routes/analytics";
import adminRoutes from "./routes/admin";

const app = express();

app.set("trust proxy", 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.storeUrl, credentials: true }));
app.use(morgan(config.isDev ? "dev" : "combined"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

const apiLimiter = rateLimit({ windowMs: 60_000, max: 120 });
const trackingLimiter = rateLimit({ windowMs: 10_000, max: 30 });

app.use("/track", trackingLimiter, trackingRoutes);
app.use("/affiliates", apiLimiter, affiliateRoutes);
app.use("/analytics", apiLimiter, analyticsRoutes);
app.use("/admin", apiLimiter, adminRoutes);
app.use("/unsubscribe", trackingRoutes);
app.use("/apply", affiliateRoutes);

// Serve the dashboard
app.use("/dashboard", express.static(path.join(__dirname, "../../dashboard")));

app.get("/health", (_req, res) => res.json({ status: "ok", ts: new Date().toISOString() }));

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

export default app;
