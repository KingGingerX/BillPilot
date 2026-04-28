import cron from "node-cron";
import { prisma } from "../db/client";
import { clearConversions } from "../tracking/conversions";
import { config } from "../config";
import { logger } from "../utils/logger";

export function startPayoutJob(): void {
  // Weekly: process pending payouts for eligible affiliates
  cron.schedule(config.cron.payout, async () => {
    logger.info("[job/payout] processing weekly payouts");
    try {
      await clearConversions(14);

      const affiliates = await prisma.affiliate.findMany({
        where: {
          status: "ACTIVE",
          pendingPayout: { gte: config.payouts.minimumCents },
        },
      });

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

        logger.info(`[job/payout] queued payout for ${aff.code}: $${(aff.pendingPayout / 100).toFixed(2)}`);
      }

      logger.info(`[job/payout] queued ${affiliates.length} payouts`);
    } catch (err) {
      logger.error("[job/payout] error:", err);
    }
  });

  // Daily snapshot at 23:55
  cron.schedule("55 23 * * *", async () => {
    const today = new Date().toISOString().split("T")[0];
    const [clicks, conversions, revenueAgg] = await Promise.all([
      prisma.click.count({ where: { createdAt: { gte: new Date(today) } } }),
      prisma.conversion.count({ where: { createdAt: { gte: new Date(today) } } }),
      prisma.conversion.aggregate({
        _sum: { amount: true, commission: true },
        where: { createdAt: { gte: new Date(today) } },
      }),
      prisma.affiliate.count({ where: { joinedAt: { gte: new Date(today) } } }),
      prisma.prospect.count({ where: { foundAt: { gte: new Date(today) } } }),
    ]);

    await prisma.dailySnapshot.upsert({
      where: { date: today },
      update: {
        clicks,
        conversions,
        revenue: revenueAgg._sum.amount ?? 0,
        commission: revenueAgg._sum.commission ?? 0,
      },
      create: {
        date: today,
        clicks,
        conversions,
        revenue: revenueAgg._sum.amount ?? 0,
        commission: revenueAgg._sum.commission ?? 0,
      },
    });
  });

  logger.info(`[job/payout] scheduled: ${config.cron.payout}`);
}
