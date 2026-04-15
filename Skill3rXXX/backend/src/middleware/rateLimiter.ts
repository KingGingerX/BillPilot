/**
 * Rate limiting middleware using express-rate-limit.
 * Different limits are applied to auth, API, and webhook routes.
 */
import rateLimit from "express-rate-limit";
import { config } from "../config";

/** General API rate limit */
export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later." },
});

/** Stricter limit for auth endpoints */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts, please try again later." },
});

/** Loose limit for public storefront */
export const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Rate limit exceeded." },
});
