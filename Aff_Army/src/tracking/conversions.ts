import { prisma } from "../db/client";
import { ConversionPayload } from "../models/types";
import { getAffiliateBySession } from "./clicks";
import { logger } from "../utils/logger";

export async function recordConversion(payload: ConversionPayload): Promise<boolean> {
  const { orderId, amount, affiliateCode, sessionId } = payload;

  // Resolve affiliate ID from code OR session cookie
  let affiliateId: string | null = null;

  if (affiliateCode) {
    const aff = await prisma.affiliate.findUnique({
      where: { code: affiliateCode.toUpperCase() },
    });
    affiliateId = aff?.id ?? null;
  }

  if (!affiliateId && sessionId) {
    affiliateId = await getAffiliateBySession(sessionId);
  }

  if (!affiliateId) {
    logger.info(`[tracking] conversion for order ${orderId} — no affiliate found`);
    return false;
  }

  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) return false;

  const commission = Math.round(amount * affiliate.commissionRate);

  try {
    await prisma.conversion.create({
      data: {
        affiliateId,
        orderId,
        amount,
        commission,
        clickId: null,
      },
    });

    await prisma.affiliate.update({
      where: { id: affiliateId },
      data: {
        totalConversions: { increment: 1 },
        totalEarnings: { increment: commission },
        pendingPayout: { increment: commission },
      },
    });

    // Mark the click as converted
    if (sessionId) {
      await prisma.click.updateMany({
        where: { sessionId, converted: false },
        data: { converted: true },
      });
    }

    logger.info(`[tracking] conversion: order ${orderId} → ${affiliate.code} earned $${(commission / 100).toFixed(2)}`);
    return true;
  } catch (err: any) {
    if (err.code === "P2002") {
      logger.warn(`[tracking] duplicate conversion for order ${orderId}`);
    } else {
      logger.error(`[tracking] conversion error:`, err);
    }
    return false;
  }
}

export async function clearConversions(daysOld = 14): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const { count } = await prisma.conversion.updateMany({
    where: { status: "PENDING", createdAt: { lte: cutoff } },
    data: { status: "CLEARED" },
  });

  logger.info(`[tracking] cleared ${count} conversions past refund window`);
  return count;
}
