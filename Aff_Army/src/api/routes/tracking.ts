import { Router, Request, Response } from "express";
import { recordClick } from "../../tracking/clicks";
import { recordConversion } from "../../tracking/conversions";
import { config } from "../../config";
import { logger } from "../../utils/logger";

const router = Router();

// GET /track/click/:code — redirect visitor and record click
router.get("/click/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  const { sessionId, found } = await recordClick(code, req);

  const ttl = config.cookie.ttlDays * 24 * 60 * 60 * 1000;

  if (found) {
    res.cookie("aff_code", code.toUpperCase(), { maxAge: ttl, httpOnly: true, sameSite: "lax" });
    res.cookie("aff_sid", sessionId, { maxAge: ttl, httpOnly: true, sameSite: "lax" });
  }

  const dest = (req.query.to as string) ?? config.storeUrl;
  res.redirect(302, dest);
});

// GET /track/pixel/:code.gif — 1x1 tracking pixel (email open tracking)
router.get("/pixel/:id.gif", async (req: Request, res: Response) => {
  // Mark outreach message as opened
  const { id } = req.params;
  try {
    await import("../../db/client").then(({ prisma }) =>
      prisma.outreachMessage.updateMany({
        where: { id, opened: false },
        data: { opened: true, openedAt: new Date() },
      })
    );
  } catch { /* ignore */ }

  const pixel = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" });
  res.send(pixel);
});

// POST /track/conversion — called by your store on purchase
router.post("/conversion", async (req: Request, res: Response) => {
  const { orderId, amount, affiliateCode } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ error: "orderId and amount required" });
  }

  const sessionId = req.cookies?.aff_sid as string | undefined;
  const cookieCode = req.cookies?.aff_code as string | undefined;

  const success = await recordConversion({
    orderId: String(orderId),
    amount: Number(amount),
    affiliateCode: affiliateCode ?? cookieCode,
    sessionId,
  });

  res.json({ success });
});

// GET /track/unsubscribe — prospect unsubscribes from outreach
router.get("/unsubscribe", async (req: Request, res: Response) => {
  const id = req.query.id as string;
  if (id) {
    await import("../../db/client").then(({ prisma }) =>
      prisma.prospect
        .update({ where: { id }, data: { status: "UNSUBSCRIBED" } })
        .catch(() => null)
    );
  }
  res.send("<html><body style='font-family:sans-serif;text-align:center;margin-top:80px'><h2>You've been unsubscribed.</h2><p>You won't receive any more emails from us.</p></body></html>");
});

export default router;
