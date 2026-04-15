/**
 * Centralised configuration module.
 * All env vars are validated here at startup — if a required var is missing
 * the process exits immediately with a clear error (fail-fast).
 */
import dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

function optional(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optional("NODE_ENV", "development") as "development" | "production" | "test",
  port: parseInt(optional("PORT", "4000"), 10),
  frontendUrl: optional("FRONTEND_URL", "http://localhost:3000"),

  db: {
    url: required("DATABASE_URL"),
  },

  redis: {
    url: optional("REDIS_URL", "redis://localhost:6379"),
    password: optional("REDIS_PASSWORD"),
  },

  jwt: {
    secret: required("JWT_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    expiresIn: optional("JWT_EXPIRES_IN", "15m"),
    refreshExpiresIn: optional("JWT_REFRESH_EXPIRES_IN", "7d"),
  },

  encryption: {
    key: required("ENCRYPTION_KEY"),
  },

  stripe: {
    secretKey: required("STRIPE_SECRET_KEY"),
    webhookSecret: required("STRIPE_WEBHOOK_SECRET"),
    publishableKey: required("STRIPE_PUBLISHABLE_KEY"),
  },

  email: {
    host: optional("SMTP_HOST", "smtp.ethereal.email"),
    port: parseInt(optional("SMTP_PORT", "587"), 10),
    user: optional("SMTP_USER"),
    password: optional("SMTP_PASSWORD"),
    from: optional("SMTP_FROM", "noreply@pims.local"),
  },

  rateLimit: {
    windowMs: parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000"), 10),
    max: parseInt(optional("RATE_LIMIT_MAX", "100"), 10),
  },

  openai: {
    apiKey: optional("OPENAI_API_KEY"),
  },

  internalWebhookSecret: optional("INTERNAL_WEBHOOK_SECRET"),

  isDev(): boolean { return this.env === "development"; },
  isProd(): boolean { return this.env === "production"; },
  isTest(): boolean { return this.env === "test"; },
};
