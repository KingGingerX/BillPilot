/**
 * Stripe Connect Controller
 * Thin HTTP layer over connect.service.ts
 */
import { Request, Response } from "express";
import * as ConnectService from "./connect.service";

/** Step 1 — affiliate clicks "Connect with Stripe" */
export async function startOnboarding(req: Request, res: Response): Promise<void> {
  const result = await ConnectService.createConnectAccount(req.user!.userId);
  res.status(201).json({ success: true, data: result });
}

/** Step 2 — affiliate needs a fresh link (previous expired) */
export async function refreshOnboardingLink(req: Request, res: Response): Promise<void> {
  const url = await ConnectService.getOnboardingLink(req.user!.userId);
  res.json({ success: true, data: { onboardingUrl: url } });
}

/** Returns a login link to the affiliate's Express dashboard */
export async function getDashboardLink(req: Request, res: Response): Promise<void> {
  const url = await ConnectService.getExpressDashboardLink(req.user!.userId);
  res.json({ success: true, data: { url } });
}

/** Returns current Connect account status */
export async function getStatus(req: Request, res: Response): Promise<void> {
  const status = await ConnectService.getConnectStatus(req.user!.userId);
  res.json({ success: true, data: status });
}

/** Disconnect the Stripe Connect account */
export async function disconnect(req: Request, res: Response): Promise<void> {
  await ConnectService.disconnectAccount(req.user!.userId);
  res.json({ success: true, message: "Stripe Connect account disconnected" });
}

/** Admin: manually trigger a transfer for any payout */
export async function adminExecuteTransfer(req: Request, res: Response): Promise<void> {
  const transfer = await ConnectService.executeTransfer(req.params.payoutId);
  res.json({ success: true, data: { transferId: transfer.id } });
}
