import { Router, Request, Response } from "express";
import { prisma } from "../../db/client";
import { requireAdmin } from "../middleware/auth";

const router = Router();
router.use(requireAdmin);

// GET /analytics/summary — top-level KPIs
router.get("/summary", async (_req: Request, res: Response) => {
  const [
    totalAffiliates,
    activeAffiliates,
    totalProspects,
    pendingOutreach,
    clicksAgg,
    conversionsAgg,
    pendingPayout,
  ] = await Promise.all([
    prisma.affiliate.count(),
    prisma.affiliate.count({ where: { status: "ACTIVE" } }),
    prisma.prospect.count(),
    prisma.prospect.count({ where: { status: "FOUND" } }),
    prisma.click.count(),
    prisma.conversion.count(),
    prisma.affiliate.aggregate({ _sum: { pendingPayout: true } }),
  ]);

  const revenueAgg = await prisma.conversion.aggregate({ _sum: { amount: true, commission: true } });

  const convRate = clicksAgg > 0
    ? ((conversionsAgg / clicksAgg) * 100).toFixed(2) + "%"
    : "0%";

  res.json({
    totalAffiliates,
    activeAffiliates,
    totalProspects,
    pendingOutreach,
    totalClicks: clicksAgg,
    totalConversions: conversionsAgg,
    totalRevenue: revenueAgg._sum.amount ?? 0,
    totalCommission: revenueAgg._sum.commission ?? 0,
    pendingPayouts: pendingPayout._sum.pendingPayout ?? 0,
    conversionRate: convRate,
  });
});

// GET /analytics/daily?days=30 — daily snapshots for chart
router.get("/daily", async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 90);
  const snapshots = await prisma.dailySnapshot.findMany({
    orderBy: { date: "desc" },
    take: days,
  });
  res.json(snapshots.reverse());
});

// GET /analytics/affiliates — leaderboard
router.get("/affiliates", async (_req: Request, res: Response) => {
  const affiliates = await prisma.affiliate.findMany({
    orderBy: { totalEarnings: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      email: true,
      code: true,
      commissionRate: true,
      totalClicks: true,
      totalConversions: true,
      totalEarnings: true,
      pendingPayout: true,
      totalPaid: true,
      status: true,
      joinedAt: true,
    },
  });
  res.json(affiliates);
});

// GET /analytics/prospects — prospect pipeline
router.get("/prospects", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const prospects = await prisma.prospect.findMany({
    where: status ? { status: status as any } : undefined,
    orderBy: { score: "desc" },
    take: 100,
    include: { _count: { select: { outreach: true } } },
  });
  res.json(prospects);
});

export default router;
