/**
 * Subscriptions Service — Stripe recurring billing, plan management,
 * and subscription lifecycle (create, cancel, upgrade, downgrade).
 */
import Stripe from "stripe";
import { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { config } from "../../config";
import { NotFoundError, AppError } from "../../middleware/errorHandler";

const prisma = new PrismaClient();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2024-04-10" });

// ── Plans ─────────────────────────────────────────────────────

export async function listPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { priceInCents: "asc" },
  });
}

export async function getPlan(id: string) {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id } });
  if (!plan) throw new NotFoundError("Subscription plan");
  return plan;
}

// ── Create / Checkout ─────────────────────────────────────────

export async function createSubscriptionCheckout(
  userId: string,
  planId: string,
  successUrl: string,
  cancelUrl: string
) {
  const plan = await getPlan(planId);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404);

  if (!plan.stripePriceId) {
    throw new AppError("Plan not configured for Stripe", 500);
  }

  // Check if plan already has a Stripe customer ID stored
  const existingSub = await prisma.subscription.findUnique({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    customer: existingSub?.stripeCustomerId ?? undefined,
    customer_email: existingSub?.stripeCustomerId ? undefined : user.email,
    subscription_data: {
      metadata: { userId, planId },
      trial_period_days: 7, // 7-day free trial on first subscription
    },
    metadata: { userId, planId },
  });

  return { sessionId: session.id, url: session.url };
}

// ── Status & Management ───────────────────────────────────────

export async function getUserSubscription(userId: string) {
  return prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });
}

export async function cancelSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeSubscriptionId) throw new NotFoundError("Subscription");

  // Cancel at period end — user keeps access until billing cycle ends
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: true },
    include: { plan: true },
  });
}

export async function reactivateSubscription(userId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeSubscriptionId) throw new NotFoundError("Subscription");

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd: false },
    include: { plan: true },
  });
}

export async function changePlan(userId: string, newPlanId: string) {
  const [sub, newPlan] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    getPlan(newPlanId),
  ]);

  if (!sub?.stripeSubscriptionId) throw new AppError("No active subscription", 400);
  if (!newPlan.stripePriceId) throw new AppError("New plan has no Stripe price", 500);

  // Get current subscription items from Stripe
  const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  const itemId = stripeSub.items.data[0].id;

  // Prorate upgrade/downgrade
  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    items: [{ id: itemId, price: newPlan.stripePriceId }],
    proration_behavior: "always_invoice",
  });

  return prisma.subscription.update({
    where: { userId },
    data: { planId: newPlanId },
    include: { plan: true },
  });
}

// ── Revenue aggregates ────────────────────────────────────────

export async function getSubscriptionRevenue() {
  const activeCount = await prisma.subscription.count({
    where: { status: SubscriptionStatus.ACTIVE },
  });

  const trialingCount = await prisma.subscription.count({
    where: { status: SubscriptionStatus.TRIALING },
  });

  // MRR calculation: sum of active subscription plan prices
  const activeSubs = await prisma.subscription.findMany({
    where: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] } },
    include: { plan: true },
  });

  const mrrCents = activeSubs.reduce((sum, sub) => {
    // Normalize to monthly
    const monthlyPrice =
      sub.plan.intervalDays === 365
        ? Math.round(sub.plan.priceInCents / 12)
        : sub.plan.priceInCents;
    return sum + monthlyPrice;
  }, 0);

  return {
    activeSubscriptions: activeCount,
    trialingSubscriptions: trialingCount,
    mrrInCents: mrrCents,
    arrInCents: mrrCents * 12,
  };
}
