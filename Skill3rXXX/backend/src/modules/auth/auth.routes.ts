import { Router } from "express";
import { authLimiter } from "../../middleware/rateLimiter";
import { validate } from "../../middleware/validate";
import { requireAuth } from "../../middleware/auth";
import * as ctrl from "./auth.controller";
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from "./auth.schema";

const router = Router();

// Public routes
router.post("/register",        authLimiter, validate(RegisterSchema),        ctrl.register);
router.post("/login",           authLimiter, validate(LoginSchema),           ctrl.login);
router.post("/refresh",         validate(RefreshSchema),                       ctrl.refresh);
router.post("/logout",          ctrl.logout);
router.get("/verify-email",     ctrl.verifyEmail);
router.post("/forgot-password", authLimiter, validate(ForgotPasswordSchema),  ctrl.forgotPassword);
router.post("/reset-password",  authLimiter, validate(ResetPasswordSchema),   ctrl.resetPassword);

// Protected routes
router.get("/me", requireAuth, ctrl.getMe);

export default router;
