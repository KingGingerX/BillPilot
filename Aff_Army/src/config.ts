import * as dotenv from "dotenv";
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional("PORT", "3500")),
  env: optional("NODE_ENV", "development"),
  baseUrl: optional("BASE_URL", "http://localhost:3500"),
  adminSecret: optional("ADMIN_SECRET", "dev-secret"),
  storeUrl: optional("STORE_URL", "https://yourstore.com"),

  smtp: {
    host: optional("SMTP_HOST", "smtp.gmail.com"),
    port: parseInt(optional("SMTP_PORT", "587")),
    user: optional("SMTP_USER", ""),
    pass: optional("SMTP_PASS", ""),
    fromName: optional("FROM_NAME", "Affiliate Program"),
    fromEmail: optional("FROM_EMAIL", "noreply@yourstore.com"),
  },

  cookie: {
    ttlDays: parseInt(optional("COOKIE_TTL_DAYS", "30")),
  },

  payouts: {
    minimumCents: parseInt(optional("PAYOUT_MINIMUM_CENTS", "2500")),
  },

  stripe: {
    secretKey: optional("STRIPE_SECRET_KEY", ""),
    webhookSecret: optional("STRIPE_WEBHOOK_SECRET", ""),
  },

  reddit: {
    clientId: optional("REDDIT_CLIENT_ID", ""),
    clientSecret: optional("REDDIT_CLIENT_SECRET", ""),
  },

  cron: {
    scout: optional("SCOUT_CRON", "0 9 * * *"),
    outreach: optional("OUTREACH_CRON", "0 10 * * *"),
    payout: optional("PAYOUT_CRON", "0 0 * * 1"),
  },

  isDev: optional("NODE_ENV", "development") === "development",
};
