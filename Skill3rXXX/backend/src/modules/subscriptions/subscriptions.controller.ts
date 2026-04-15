import { Request, Response } from "express";
import * as SubService from "./subscriptions.service";

export async function listPlans(req: Request, res: Response): Promise<void> {
  const plans = await SubService.listPlans();
  res.json({ success: true, data: plans });
}

export async function createCheckout(req: Request, res: Response): Promise<void> {
  const { planId, successUrl, cancelUrl } = req.body;
  const result = await SubService.createSubscriptionCheckout(
    req.user!.userId, planId, successUrl, cancelUrl
  );
  res.json({ success: true, data: result });
}

export async function getMySubscription(req: Request, res: Response): Promise<void> {
  const sub = await SubService.getUserSubscription(req.user!.userId);
  res.json({ success: true, data: sub });
}

export async function cancelSubscription(req: Request, res: Response): Promise<void> {
  const sub = await SubService.cancelSubscription(req.user!.userId);
  res.json({ success: true, data: sub });
}

export async function reactivate(req: Request, res: Response): Promise<void> {
  const sub = await SubService.reactivateSubscription(req.user!.userId);
  res.json({ success: true, data: sub });
}

export async function changePlan(req: Request, res: Response): Promise<void> {
  const sub = await SubService.changePlan(req.user!.userId, req.body.planId);
  res.json({ success: true, data: sub });
}

export async function getRevenue(req: Request, res: Response): Promise<void> {
  const data = await SubService.getSubscriptionRevenue();
  res.json({ success: true, data });
}
