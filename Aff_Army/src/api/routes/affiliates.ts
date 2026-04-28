import { Router, Request, Response } from "express";
import { prisma } from "../../db/client";
import { config } from "../../config";

const router = Router();

// GET /apply — affiliate signup page (redirect to dashboard or show form)
router.get("/apply", (req: Request, res: Response) => {
  res.send(`
    <html><head><title>Affiliate Application</title>
    <style>
      body{font-family:sans-serif;max-width:520px;margin:80px auto;padding:0 24px;color:#1a1a1a}
      input,textarea{width:100%;padding:10px;margin:8px 0 16px;border:1px solid #ddd;border-radius:6px;box-sizing:border-box;font-size:15px}
      button{background:#6366f1;color:#fff;border:none;padding:12px 28px;border-radius:6px;font-size:15px;cursor:pointer;width:100%}
      h1{font-size:24px}p{color:#555}
    </style></head><body>
    <h1>Join Our Affiliate Program</h1>
    <p>Earn <strong>30% commission</strong> on every sale you refer. Monthly payouts.</p>
    <form method="POST" action="/affiliates/apply">
      <input name="name" placeholder="Your name" required>
      <input name="email" type="email" placeholder="Email address" required>
      <input name="website" placeholder="Your website or social profile (optional)">
      <textarea name="notes" rows="3" placeholder="Tell us about your audience (optional)"></textarea>
      <button type="submit">Apply Now</button>
    </form>
    </body></html>`);
});

// POST /affiliates/apply — process application
router.post("/apply", async (req: Request, res: Response) => {
  const { name, email, website, notes } = req.body;
  if (!email) return res.status(400).send("Email required.");

  try {
    await prisma.prospect.upsert({
      where: { email: email.toLowerCase() },
      update: { name: name ?? undefined, website: website ?? undefined, notes: notes ?? undefined },
      create: {
        name: name ?? null,
        email: email.toLowerCase(),
        platform: "self-apply",
        website: website ?? null,
        notes: notes ?? null,
        score: 70,
        status: "RESPONDED",
      },
    });

    res.send(`<html><body style="font-family:sans-serif;text-align:center;margin-top:80px">
      <h2>Application received!</h2>
      <p>We'll review your application and get back to you within 24–48 hours.</p>
      </body></html>`);
  } catch {
    res.status(500).send("Something went wrong. Please try again.");
  }
});

// GET /affiliates/:code/stats — public stats page for affiliate
router.get("/:code/stats", async (req: Request, res: Response) => {
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: req.params.code.toUpperCase() },
    select: {
      name: true,
      code: true,
      totalClicks: true,
      totalConversions: true,
      totalEarnings: true,
      pendingPayout: true,
      totalPaid: true,
      commissionRate: true,
    },
  });

  if (!affiliate) return res.status(404).json({ error: "Not found" });
  res.json(affiliate);
});

export default router;
