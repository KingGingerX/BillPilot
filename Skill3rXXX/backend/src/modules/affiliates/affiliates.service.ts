/**
 * Affiliates Service — tracks referral links, clicks, conversions,
 * computes commissions, and manages payout requests.
 */
import { PrismaClient, PayoutStatus } from "@prisma/client";
import { encrypt, decrypt } from "../../utils/crypto";
import { NotFoundError, AppError, ForbiddenError } from "../../middleware/errorHandler";

const prisma = new PrismaClient();

// ── Profile ───────────────────────────────────────────────────

export async function applyAffiliate(userId: string) {
  const exists = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (exists) throw new AppError("Affiliate profile already exists", 409);

  // Generate unique short code (6 chars, retry on collision)
  let code: string;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const conflict = await prisma.affiliateProfile.findUnique({ where: { code } });
    if (!conflict) break;
    attempts++;
  } while (attempts < 10);

  return prisma.affiliateProfile.create({
    data: { userId, code, isApproved: false },
  });
}

export async function getMyProfile(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({
    where: { userId },
    include: {
      _count: { select: { clicks: true, conversions: true, payouts: true } },
    },
  });
  if (!profile) throw new NotFoundError("Affiliate profile");

  // Mask the PayPal email if present
  return {
    ...profile,
    paypalEmail: profile.paypalEmail ? "••••••@••••" : null,
  };
}

export async function updatePayoutDetails(
  userId: string,
  paypalEmail?: string,
  stripeAccountId?: string
) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Affiliate profile");

  return prisma.affiliateProfile.update({
    where: { userId },
    data: {
      paypalEmail: paypalEmail ? encrypt(paypalEmail) : undefined,
      stripeAccountId: stripeAccountId ?? undefined,
    },
  });
}

// ── Click Tracking ────────────────────────────────────────────

/**
 * Called when a visitor lands on a page via an affiliate link.
 * Records the click for analytics and sets a tracking cookie (done in controller).
 */
export async function trackClick(
  code: string,
  ipAddress: string,
  userAgent: string,
  referrerUrl: string,
  landingPage: string
) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { code } });
  if (!profile || !profile.isApproved) return null; // Silently ignore unapproved

  await prisma.affiliateClick.create({
    data: { profileId: profile.id, ipAddress, userAgent, referrerUrl, landingPage },
  });

  return { affiliateId: profile.id, code };
}

// ── Conversions ───────────────────────────────────────────────

/**
 * Called from the Stripe webhook after a successful payment.
 * Looks up the affiliate code in the order and creates a commission record.
 */
export async function recordConversion(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order?.affiliateCode) return; // No affiliate code on this order

  const profile = await prisma.affiliateProfile.findUnique({
    where: { code: order.affiliateCode },
  });
  if (!profile || !profile.isApproved) return;

  const commissionInCents = Math.floor(order.totalAmountInCents * profile.commissionRate);

  // Use a transaction to record conversion and update earnings atomically
  await prisma.$transaction([
    prisma.affiliateConversion.create({
      data: { profileId: profile.id, orderId, commissionInCents },
    }),
    prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: {
        totalEarnings: { increment: commissionInCents },
        pendingPayout: { increment: commissionInCents },
      },
    }),
  ]);
}

// ── Payouts ───────────────────────────────────────────────────

/** Minimum payout threshold: $50 */
const MIN_PAYOUT_CENTS = 5000;

export async function requestPayout(userId: string, method: "paypal" | "stripe") {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Affiliate profile");
  if (!profile.isApproved) throw new ForbiddenError("Affiliate account not yet approved");
  if (profile.pendingPayout < MIN_PAYOUT_CENTS) {
    throw new AppError(
      `Minimum payout is $${MIN_PAYOUT_CENTS / 100}. Current balance: $${profile.pendingPayout / 100}`,
      400
    );
  }

  if (method === "paypal" && !profile.paypalEmail) {
    throw new AppError("PayPal email not configured", 400);
  }
  if (method === "stripe" && !profile.stripeAccountId) {
    throw new AppError("Stripe Connect account not configured", 400);
  }

  const amount = profile.pendingPayout;

  const [payout] = await prisma.$transaction([
    prisma.affiliatePayout.create({
      data: { profileId: profile.id, amountInCents: amount, method, status: PayoutStatus.PENDING },
    }),
    prisma.affiliateProfile.update({
      where: { id: profile.id },
      data: { pendingPayout: 0 }, // Reset pending; actual transfer processed by admin job
    }),
  ]);

  return payout;
}

export async function getPayouts(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Affiliate profile");

  return prisma.affiliatePayout.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
}

// ── Analytics ─────────────────────────────────────────────────

export async function getAffiliateStats(userId: string) {
  const profile = await prisma.affiliateProfile.findUnique({ where: { userId } });
  if (!profile) throw new NotFoundError("Affiliate profile");

  const [clicks, conversions] = await Promise.all([
    prisma.affiliateClick.count({ where: { profileId: profile.id } }),
    prisma.affiliateConversion.findMany({ where: { profileId: profile.id } }),
  ]);

  const totalCommission = conversions.reduce((sum, c) => sum + c.commissionInCents, 0);
  const conversionRate = clicks > 0 ? (conversions.length / clicks) * 100 : 0;

  return {
    code: profile.code,
    totalClicks: clicks,
    totalConversions: conversions.length,
    conversionRate: parseFloat(conversionRate.toFixed(2)),
    totalEarningsCents: totalCommission,
    pendingPayoutCents: profile.pendingPayout,
    totalPaidCents: profile.totalPaid,
    commissionRate: profile.commissionRate,
  };
}

// ── Admin ─────────────────────────────────────────────────────

export async function approveAffiliate(profileId: string) {
  return prisma.affiliateProfile.update({
    where: { id: profileId },
    data: { isApproved: true },
  });
}

export async function listAllAffiliates() {
  return prisma.affiliateProfile.findMany({
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
      _count: { select: { clicks: true, conversions: true } },
    },
    orderBy: { totalEarnings: "desc" },
  });
}

export async function processPayout(payoutId: string, reference: string) {
  const payout = await prisma.affiliatePayout.findUnique({ where: { id: payoutId } });
  if (!payout) throw new NotFoundError("Payout");

  return prisma.$transaction([
    prisma.affiliatePayout.update({
      where: { id: payoutId },
      data: { status: PayoutStatus.PAID, reference, processedAt: new Date() },
    }),
    prisma.affiliateProfile.update({
      where: { id: payout.profileId },
      data: { totalPaid: { increment: payout.amountInCents } },
    }),
  ]);
}
