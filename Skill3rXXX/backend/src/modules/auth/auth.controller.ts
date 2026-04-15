/**
 * Auth Controller — thin HTTP layer.
 * All business logic lives in auth.service.ts.
 */
import { Request, Response } from "express";
import * as AuthService from "./auth.service";

export async function register(req: Request, res: Response): Promise<void> {
  const result = await AuthService.register(req.body);
  res.status(201).json({ success: true, data: result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await AuthService.login(req.body);
  res.json({ success: true, data: result });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const tokens = await AuthService.refreshTokens(req.body.refreshToken);
  res.json({ success: true, data: tokens });
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.body.refreshToken) await AuthService.logout(req.body.refreshToken);
  res.json({ success: true, message: "Logged out successfully" });
}

export async function verifyEmail(req: Request, res: Response): Promise<void> {
  await AuthService.verifyEmail(req.query.token as string);
  res.json({ success: true, message: "Email verified successfully" });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await AuthService.forgotPassword(req.body.email);
  res.json({ success: true, message: "If that email exists, a reset link has been sent" });
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await AuthService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, message: "Password reset successfully" });
}

export async function getMe(req: Request, res: Response): Promise<void> {
  const user = await AuthService.getMe(req.user!.userId);
  res.json({ success: true, data: user });
}
