import { prisma } from "../db/client";
import { Request } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../utils/logger";

export async function recordClick(
  code: string,
  req: Request
): Promise<{ sessionId: string; found: boolean }> {
  const affiliate = await prisma.affiliate.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!affiliate || affiliate.status !== "ACTIVE") {
    return { sessionId: "", found: false };
  }

  const sessionId = uuidv4();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? "";
  const landing = req.query.landing as string | undefined;
  const referrer = req.get("referer") ?? undefined;

  await prisma.click.create({
    data: {
      affiliateId: affiliate.id,
      ip: ip.substring(0, 45),
      userAgent: req.get("user-agent")?.substring(0, 512) ?? null,
      referrer: referrer?.substring(0, 512) ?? null,
      landing: landing?.substring(0, 512) ?? null,
      sessionId,
    },
  });

  await prisma.affiliate.update({
    where: { id: affiliate.id },
    data: { totalClicks: { increment: 1 } },
  });

  logger.info(`[tracking] click: ${code} session:${sessionId}`);
  return { sessionId, found: true };
}

export async function getAffiliateBySession(sessionId: string): Promise<string | null> {
  const click = await prisma.click.findFirst({
    where: { sessionId, converted: false },
    select: { affiliateId: true },
  });
  return click?.affiliateId ?? null;
}
