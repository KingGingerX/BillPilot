import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { publicLimiter } from "../../middleware/rateLimiter";
import * as ctrl from "./affiliates.controller";
import * as connectCtrl from "./connect.controller";

const router = Router();

// ── Public: click tracking redirect ──────────────────────────
router.get("/track/:code", publicLimiter, ctrl.trackClick);

// ── Affiliate self-service ────────────────────────────────────
router.post("/apply",          requireAuth, ctrl.apply);
router.get("/me",              requireAuth, ctrl.getMyProfile);
router.patch("/me/payout",     requireAuth, ctrl.updatePayoutDetails);
router.get("/me/stats",        requireAuth, ctrl.getMyStats);
router.post("/me/payout",      requireAuth, ctrl.requestPayout);
router.get("/me/payouts",      requireAuth, ctrl.getPayouts);

// ── Stripe Connect onboarding ─────────────────────────────────
// POST /api/affiliates/connect/start  — create account + return onboarding URL
router.post("/connect/start",          requireAuth, connectCtrl.startOnboarding);

// GET  /api/affiliates/connect/link   — get a fresh onboarding link (if expired)
router.get("/connect/link",            requireAuth, connectCtrl.refreshOnboardingLink);

// GET  /api/affiliates/connect/status — current account status + requirements
router.get("/connect/status",          requireAuth, connectCtrl.getStatus);

// GET  /api/affiliates/connect/dashboard — login link to Express dashboard
router.get("/connect/dashboard",       requireAuth, connectCtrl.getDashboardLink);

// DELETE /api/affiliates/connect      — deauthorize
router.delete("/connect",              requireAuth, connectCtrl.disconnect);

// ── Admin ─────────────────────────────────────────────────────
router.get("/admin/all",                       requireAuth, requireRole("ADMIN"), ctrl.listAll);
router.post("/admin/:id/approve",              requireAuth, requireRole("ADMIN"), ctrl.approve);
router.post("/admin/payouts/:id/process",      requireAuth, requireRole("ADMIN"), ctrl.processPayout);

// Admin: manually trigger a Stripe transfer for any pending payout
router.post("/admin/payouts/:payoutId/transfer", requireAuth, requireRole("ADMIN"), connectCtrl.adminExecuteTransfer);

export default router;
