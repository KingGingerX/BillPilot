import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as ctrl from "./content.controller";
import { CreateContentSchema, GenerateContentSchema } from "./content.schema";

const router = Router();

router.get("/",         requireAuth, ctrl.listPosts);
router.post("/",        requireAuth, validate(CreateContentSchema), ctrl.createPost);
router.get("/stats",    requireAuth, requireRole("ADMIN"), ctrl.getStats);
router.get("/:id",      requireAuth, ctrl.getPost);
router.delete("/:id",   requireAuth, ctrl.deletePost);
router.post("/generate", requireAuth, validate(GenerateContentSchema), ctrl.generateContent);

export default router;
