import { Router, Request, Response } from "express";
import { prisma } from "../../db/client";
import { requireAdmin } from "../middleware/auth";
import { approveProspect, importProspects, runScout } from "../../recruitment/scout";
import { processOutreachQueue } from "../../outreach/sequences";
import { clearConversions } from "../../tracking/conversions";
import { approvalEmail } from "../../outreach/templates";
import { sendEmail } from "../../outreach/mailer";
import { config } from "../../config";
import { logger } from "../../utils/logger";

const router = Router();
router.use(requireAdmin);

// POST /admin/prospects/import — bulk import CSV
router.post("/prospects/import", async (req: Request, res: Response) => {
  const { csv, niche } = req.body;
  if (!csv) return res.status(400).json({ error: "csv required" });
  const count = await importProspects(csv, niche ?? "general");
  res.json({ imported: count });
});

// POST /admin/prospects/scout — trigger scout run
router.post("/prospects/scout", async (req: Request, res: Response) => {
  const { niche } = req.body;
  runScout(niche).catch((e) => logger.error("[admin] scout error:", e));
  res.json({ message: "Scout started in background" });
});

// POST /admin/prospects/:id/approve — approve a prospect as affiliate
router.post("/prospects/:id/approve", async (req: Request, res: Response) => {
  try {
    const code = await approveProspect(req.params.id);
    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    const prospect = await prisma.prospect.findUnique({ where: { id: req.params.id } });

    if (affiliate && prospect) {
      const ctx = {
        affiliateName: affiliate.name,
        fromName: config.smtp.fromName,
        storeUrl: config.storeUrl,
        commissionRate: affiliate.commissionRate,
        signupUrl: `${config.baseUrl}/apply`,
        unsubscribeUrl: `${config.baseUrl}/unsubscribe?id=${prospect.id}`,
        code: affiliate.code,
        dashboardUrl: `${config.baseUrl}/affiliates/${affiliate.code}/stats`,
      };
      const tpl = approvalEmail(ctx);
      await sendEmail({ to: affiliate.email, ...tpl });
    }

    res.json({ code });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/prospects/:id/reject
router.post("/prospects/:id/reject", async (req: Request, res: Response) => {
  await prisma.prospect.update({
    where: { id: req.params.id },
    data: { status: "REJECTED" },
  });
  res.json({ ok: true });
});

// DELETE /admin/affiliates/:id — ban affiliate
router.delete("/affiliates/:id", async (req: Request, res: Response) => {
  await prisma.affiliate.update({
    where: { id: req.params.id },
    data: { status: "BANNED" },
  });
  res.json({ ok: true });
});

// PATCH /admin/affiliates/:id — update affiliate details
router.patch("/affiliates/:id", async (req: Request, res: Response) => {
  const { commissionRate, status, notes, paypalEmail } = req.body;
  const updated = await prisma.affiliate.update({
    where: { id: req.params.id },
    data: {
      commissionRate: commissionRate !== undefined ? Number(commissionRate) : undefined,
      status: status ?? undefined,
      notes: notes ?? undefined,
      paypalEmail: paypalEmail ?? undefined,
    },
  });
  res.json(updated);
});

// POST /admin/affiliates — manually create affiliate
router.post("/affiliates", async (req: Request, res: Response) => {
  const { name, email, commissionRate } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email required" });

  let code: string;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const exists = await prisma.affiliate.findUnique({ where: { code } });
    if (!exists) break;
  } while (++attempts < 20);

  const affiliate = await prisma.affiliate.create({
    data: { name, email: email.toLowerCase(), code: code!, commissionRate: Number(commissionRate ?? 0.3) },
  });
  res.status(201).json(affiliate);
});

// POST /admin/payouts/process — process pending payouts
router.post("/payouts/process", async (req: Request, res: Response) => {
  const { affiliateId } = req.body;
  const minimum = config.payouts.minimumCents;

  const where = affiliateId
    ? { id: affiliateId, pendingPayout: { gte: minimum } }
    : { pendingPayout: { gte: minimum }, status: "ACTIVE" as const };

  const affiliates = await prisma.affiliate.findMany({ where });

  const payouts: string[] = [];
  for (const aff of affiliates) {
    await prisma.$transaction([
      prisma.payout.create({
        data: {
          affiliateId: aff.id,
          amount: aff.pendingPayout,
          method: aff.paypalEmail ? "paypal" : "manual",
          status: "PENDING",
        },
      }),
      prisma.affiliate.update({
        where: { id: aff.id },
        data: {
          totalPaid: { increment: aff.pendingPayout },
          pendingPayout: 0,
        },
      }),
    ]);
    payouts.push(aff.code);
  }

  res.json({ processed: payouts.length, affiliates: payouts });
});

// POST /admin/outreach/run — trigger outreach queue
router.post("/outreach/run", async (_req: Request, res: Response) => {
  processOutreachQueue().catch((e) => logger.error("[admin] outreach error:", e));
  res.json({ message: "Outreach queue processing in background" });
});

// POST /admin/conversions/clear — clear past-refund-window conversions
router.post("/conversions/clear", async (req: Request, res: Response) => {
  const days = parseInt(req.body.days ?? "14");
  const count = await clearConversions(days);
  res.json({ cleared: count });
});

export default router;
