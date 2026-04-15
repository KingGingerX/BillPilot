/**
 * Analytics Service — aggregates revenue, traffic, and performance data
 * across all income streams. Used by the dashboard and admin panels.
 */
import { PrismaClient, SubscriptionStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ── Date helpers ──────────────────────────────────────────────

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ── Revenue dashboard ─────────────────────────────────────────

/**
 * Returns the comprehensive revenue summary for the dashboard.
 * Covers: today, last 7 days, last 30 days, all-time, and a daily series.
 */
export async function getRevenueSummary() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const last7Start = daysAgo(7);
  const last30Start = daysAgo(30);

  const [
    todayOrders,
    last7Orders,
    last30Orders,
    allTimeOrders,
    activeSubs,
    trialingSubs,
    affiliateConversions,
    dailySeries,
  ] = await Promise.all([
    // Product revenue - today
    prisma.order.aggregate({
      where: { status: "PAID", createdAt: { gte: todayStart } },
      _sum: { totalAmountInCents: true },
      _count: { id: true },
    }),
    // Product revenue - 7 days
    prisma.order.aggregate({
      where: { status: "PAID", createdAt: { gte: last7Start } },
      _sum: { totalAmountInCents: true },
      _count: { id: true },
    }),
    // Product revenue - 30 days
    prisma.order.aggregate({
      where: { status: "PAID", createdAt: { gte: last30Start } },
      _sum: { totalAmountInCents: true },
      _count: { id: true },
    }),
    // All-time orders
    prisma.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalAmountInCents: true },
      _count: { id: true },
    }),
    // Active subscriptions
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    }),
    // Trialing subscriptions
    prisma.subscription.findMany({
      where: { status: SubscriptionStatus.TRIALING },
      include: { plan: true },
    }),
    // Affiliate conversions - 30 days
    prisma.affiliateConversion.aggregate({
      where: { createdAt: { gte: last30Start } },
      _sum: { commissionInCents: true },
      _count: { id: true },
    }),
    // Daily revenue series - last 30 days
    getDailySeries(30),
  ]);

  const mrrCents = [...activeSubs, ...trialingSubs].reduce((sum, sub) => {
    const monthly =
      sub.plan.intervalDays === 365
        ? Math.round(sub.plan.priceInCents / 12)
        : sub.plan.priceInCents;
    return sum + monthly;
  }, 0);

  return {
    today: {
      revenueInCents: todayOrders._sum.totalAmountInCents ?? 0,
      orders: todayOrders._count.id,
    },
    last7Days: {
      revenueInCents: last7Orders._sum.totalAmountInCents ?? 0,
      orders: last7Orders._count.id,
    },
    last30Days: {
      revenueInCents: last30Orders._sum.totalAmountInCents ?? 0,
      orders: last30Orders._count.id,
    },
    allTime: {
      revenueInCents: allTimeOrders._sum.totalAmountInCents ?? 0,
      orders: allTimeOrders._count.id,
    },
    subscriptions: {
      active: activeSubs.length,
      trialing: trialingSubs.length,
      mrrInCents: mrrCents,
      arrInCents: mrrCents * 12,
    },
    affiliates: {
      last30DaysCommission: affiliateConversions._sum.commissionInCents ?? 0,
      last30DaysConversions: affiliateConversions._count.id,
    },
    dailySeries,
  };
}

/**
 * Returns a day-by-day revenue breakdown for the last N days.
 */
async function getDailySeries(days: number) {
  const orders = await prisma.order.findMany({
    where: { status: "PAID", createdAt: { gte: daysAgo(days) } },
    select: { totalAmountInCents: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Build a map of date → revenue
  const map: Record<string, number> = {};
  orders.forEach((o) => {
    const key = o.createdAt.toISOString().slice(0, 10);
    map[key] = (map[key] ?? 0) + o.totalAmountInCents;
  });

  // Fill in zeros for days with no orders
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, revenueInCents: map[key] ?? 0 });
  }
  return result;
}

// ── Snapshot (called by nightly job) ─────────────────────────

export async function createDailySnapshot(date: Date = new Date()) {
  const d = startOfDay(date);

  const [productRevRaw, subCount, affConvRaw, affClickRaw, newOrders, newSubs] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "PAID", createdAt: { gte: d, lte: endOfDay(d) } },
      _sum: { totalAmountInCents: true },
    }),
    prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.affiliateConversion.aggregate({
      where: { createdAt: { gte: d, lte: endOfDay(d) } },
      _sum: { commissionInCents: true },
      _count: { id: true },
    }),
    prisma.affiliateClick.count({ where: { createdAt: { gte: d, lte: endOfDay(d) } } }),
    prisma.order.count({ where: { status: "PAID", createdAt: { gte: d, lte: endOfDay(d) } } }),
    prisma.subscription.count({ where: { createdAt: { gte: d, lte: endOfDay(d) } } }),
  ]);

  const productRevCents = productRevRaw._sum.totalAmountInCents ?? 0;
  const affRevCents = affConvRaw._sum.commissionInCents ?? 0;

  await prisma.revenueSnapshot.upsert({
    where: { date: d },
    update: {
      productRevenueCents: productRevCents,
      activeSubscriptions: subCount,
      affiliateRevCents: affRevCents,
      affiliateClicks: affClickRaw,
      affiliateConversions: affConvRaw._count.id,
      newOrders,
      newSubscriptions: newSubs,
      totalRevenueCents: productRevCents + affRevCents,
    },
    create: {
      date: d,
      productRevenueCents: productRevCents,
      activeSubscriptions: subCount,
      affiliateRevCents: affRevCents,
      affiliateClicks: affClickRaw,
      affiliateConversions: affConvRaw._count.id,
      newOrders,
      newSubscriptions: newSubs,
      totalRevenueCents: productRevCents + affRevCents,
    },
  });
}

export async function getRevenueSnapshots(days = 90) {
  return prisma.revenueSnapshot.findMany({
    where: { date: { gte: daysAgo(days) } },
    orderBy: { date: "asc" },
  });
}

// ── User analytics ────────────────────────────────────────────

export async function getTopProducts(limit = 10) {
  const items = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: "PAID" } },
    _sum: { priceInCents: true },
    _count: { id: true },
    orderBy: { _sum: { priceInCents: "desc" } },
    take: limit,
  });

  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const map = Object.fromEntries(products.map((p) => [p.id, p]));

  return items.map((i) => ({
    product: map[i.productId],
    revenueInCents: i._sum.priceInCents ?? 0,
    unitsSold: i._count.id,
  }));
}
