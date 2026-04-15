import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import * as ctrl from "./analytics.controller";

const router = Router();

// All analytics require admin — users see only their own data via /me endpoints
router.get("/revenue",         requireAuth, requireRole("ADMIN"), ctrl.getRevenueSummary);
router.get("/snapshots",       requireAuth, requireRole("ADMIN"), ctrl.getRevenueSnapshots);
router.get("/top-products",    requireAuth, requireRole("ADMIN"), ctrl.getTopProducts);

export default router;
