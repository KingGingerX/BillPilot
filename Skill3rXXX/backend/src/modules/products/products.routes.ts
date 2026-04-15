import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { publicLimiter } from "../../middleware/rateLimiter";
import * as ctrl from "./products.controller";
import { CreateProductSchema, UpdateProductSchema, CreateCheckoutSchema } from "./products.schema";

const router = Router();

// Public storefront
router.get("/",            publicLimiter, ctrl.listProducts);
router.get("/slug/:slug",  publicLimiter, ctrl.getProductBySlug);
router.get("/:id",         publicLimiter, ctrl.getProduct);

// Authenticated user routes
router.post("/checkout",           requireAuth, validate(CreateCheckoutSchema), ctrl.createCheckout);
router.get("/:id/download",        requireAuth, ctrl.getDownloadUrl);

// Admin only
router.post("/",       requireAuth, requireRole("ADMIN"), validate(CreateProductSchema), ctrl.createProduct);
router.patch("/:id",   requireAuth, requireRole("ADMIN"), validate(UpdateProductSchema), ctrl.updateProduct);
router.delete("/:id",  requireAuth, requireRole("ADMIN"), ctrl.deleteProduct);
router.get("/admin/revenue", requireAuth, requireRole("ADMIN"), ctrl.getProductRevenue);

export default router;
