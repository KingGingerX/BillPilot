import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { publicLimiter } from "../../middleware/rateLimiter";
import * as ctrl from "./subscriptions.controller";

const router = Router();

router.get("/plans",     publicLimiter, ctrl.listPlans);
router.post("/checkout", requireAuth, ctrl.createCheckout);
router.get("/me",        requireAuth, ctrl.getMySubscription);
router.post("/cancel",   requireAuth, ctrl.cancelSubscription);
router.post("/reactivate", requireAuth, ctrl.reactivate);
router.post("/change-plan", requireAuth, ctrl.changePlan);

// Admin
router.get("/admin/revenue", requireAuth, requireRole("ADMIN"), ctrl.getRevenue);

export default router;
