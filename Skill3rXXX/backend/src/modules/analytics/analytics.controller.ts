import { Request, Response } from "express";
import * as AnalyticsService from "./analytics.service";

export async function getRevenueSummary(req: Request, res: Response): Promise<void> {
  const data = await AnalyticsService.getRevenueSummary();
  res.json({ success: true, data });
}

export async function getRevenueSnapshots(req: Request, res: Response): Promise<void> {
  const days = parseInt(req.query.days as string ?? "90", 10);
  const data = await AnalyticsService.getRevenueSnapshots(days);
  res.json({ success: true, data });
}

export async function getTopProducts(req: Request, res: Response): Promise<void> {
  const limit = parseInt(req.query.limit as string ?? "10", 10);
  const data = await AnalyticsService.getTopProducts(limit);
  res.json({ success: true, data });
}
