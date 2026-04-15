import { Router, raw } from "express";
import { stripeWebhook } from "./webhooks.controller";

const router = Router();

/**
 * /api/webhooks/stripe
 * Uses raw body parser — Stripe signature verification requires the raw bytes.
 */
router.post("/stripe", raw({ type: "application/json" }), stripeWebhook);

export default router;
