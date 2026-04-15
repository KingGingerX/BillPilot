import { Router } from "express";
import { requireAuth, requireRole, optionalAuth } from "../../middleware/auth";
import { publicLimiter } from "../../middleware/rateLimiter";
import * as ctrl from "./affiliates.controller";

const router = Router();

// Public: click tracking redirect
router.get("/track/:code", publicLimiter, ctrl.trackClick);

// Authenticated affiliate routes
router.post("/apply",          requireAuth, ctrl.apply);
router.get("/me",              requireAuth, ctrl.getMyProfile);
router.patch("/me/payout",     requireAuth, ctrl.updatePayoutDetails);
router.get("/me/stats",        requireAuth, ctrl.getMyStats);
router.post("/me/payout",      requireAuth, ctrl.requestPayout);
router.get("/me/payouts",      requireAuth, ctrl.getPayouts);

// Admin
router.get("/admin/all",               requireAuth, requireRole("ADMIN"), ctrl.listAll);
router.post("/admin/:id/approve",      requireAuth, requireRole("ADMIN"), ctrl.approve);
router.post("/admin/payouts/:id/process", requireAuth, requireRole("ADMIN"), ctrl.processPayout);

export default router;
