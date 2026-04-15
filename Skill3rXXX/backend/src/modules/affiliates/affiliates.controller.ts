import { Request, Response } from "express";
import * as AffService from "./affiliates.service";

export async function apply(req: Request, res: Response): Promise<void> {
  const profile = await AffService.applyAffiliate(req.user!.userId);
  res.status(201).json({ success: true, data: profile });
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  const profile = await AffService.getMyProfile(req.user!.userId);
  res.json({ success: true, data: profile });
}

export async function updatePayoutDetails(req: Request, res: Response): Promise<void> {
  const { paypalEmail, stripeAccountId } = req.body;
  const profile = await AffService.updatePayoutDetails(req.user!.userId, paypalEmail, stripeAccountId);
  res.json({ success: true, data: profile });
}

export async function trackClick(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const { landingPage } = req.query as { landingPage: string };
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? "";
  const ua = req.headers["user-agent"] ?? "";
  const ref = req.headers["referer"] ?? "";

  const result = await AffService.trackClick(code, ip, ua, ref, landingPage ?? "/");
  // Redirect to landing page (or home if not specified)
  res.redirect(landingPage ?? "/");
}

export async function getMyStats(req: Request, res: Response): Promise<void> {
  const stats = await AffService.getAffiliateStats(req.user!.userId);
  res.json({ success: true, data: stats });
}

export async function requestPayout(req: Request, res: Response): Promise<void> {
  const payout = await AffService.requestPayout(req.user!.userId, req.body.method);
  res.json({ success: true, data: payout });
}

export async function getPayouts(req: Request, res: Response): Promise<void> {
  const payouts = await AffService.getPayouts(req.user!.userId);
  res.json({ success: true, data: payouts });
}

// Admin
export async function listAll(req: Request, res: Response): Promise<void> {
  const affiliates = await AffService.listAllAffiliates();
  res.json({ success: true, data: affiliates });
}

export async function approve(req: Request, res: Response): Promise<void> {
  const profile = await AffService.approveAffiliate(req.params.id);
  res.json({ success: true, data: profile });
}

export async function processPayout(req: Request, res: Response): Promise<void> {
  const result = await AffService.processPayout(req.params.id, req.body.reference);
  res.json({ success: true, data: result });
}
