/**
 * Stripe Webhook Handler.
 * IMPORTANT: This route must receive the raw body (not JSON-parsed)
 * so Stripe's signature verification works correctly.
 * The route is registered before express.json() in app.ts.
 */
import { Request, Response } from "express";
import Stripe from "stripe";
import { PrismaClient, SubscriptionStatus } from "@prisma/client";
import { config } from "../../config";
import { recordConversion } from "../affiliates/affiliates.service";
import { syncAccountStatus } from "../affiliates/connect.service";
import { sendEmail, orderConfirmTemplate } from "../../utils/email";
import { logger } from "../../utils/logger";

const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2024-04-10" });
const prisma = new PrismaClient();

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];
  if (!sig) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event: Stripe.Event;
  try {
    // req.body is a raw Buffer here (set up by express.raw() in app.ts)
    event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
  } catch (err) {
    logger.warn("Stripe webhook signature verification failed", { err });
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  logger.info("Stripe webhook received", { type: event.type });

  try {
    await handleEvent(event);
    res.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook handler error", { type: event.type, err });
    // Return 200 to prevent Stripe from retrying non-retryable errors
    res.json({ received: true, error: "Handler error logged" });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;

    case "invoice.payment_succeeded":
      await handleInvoicePaid(event.data.object as Stripe.Invoice);
      break;

    case "invoice.payment_failed":
      await handleInvoiceFailed(event.data.object as Stripe.Invoice);
      break;

    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
      break;

    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;

    // ── Stripe Connect account lifecycle ───────────────────────
    case "account.updated":
      // Fires whenever an affiliate's Express account changes status
      // (e.g., finishes identity verification, gets restricted, etc.)
      await syncAccountStatus(event.data.object as Stripe.Account);
      break;

    default:
      logger.debug("Unhandled webhook event type", { type: event.type });
  }
}

// ── Handlers ──────────────────────────────────────────────────

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    // One-time product purchase
    const order = await prisma.order.findFirst({
      where: { stripeSessionId: session.id },
      include: { user: true, items: { include: { product: true } } },
    });
    if (!order) return;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        stripePaymentIntent: session.payment_intent as string,
      },
    });

    // Increment product sales count
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { salesCount: { increment: item.quantity } },
      });
    }

    // Record affiliate commission if applicable
    await recordConversion(order.id);

    // Send confirmation email
    const totalStr = `$${(order.totalAmountInCents / 100).toFixed(2)}`;
    const downloadUrl = `${config.frontendUrl}/downloads?orderId=${order.id}`;
    void sendEmail({
      to: order.user.email,
      subject: "Your PIMS purchase is confirmed!",
      html: orderConfirmTemplate(order.user.firstName, totalStr, downloadUrl),
    });
  }

  if (session.mode === "subscription") {
    // Subscription checkout — full subscription details come via subscription webhook
    const { userId, planId } = session.metadata ?? {};
    if (!userId || !planId) return;

    const stripeSubId = session.subscription as string;
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
    const customerId = session.customer as string;

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        planId,
        stripeSubscriptionId: stripeSubId,
        stripeCustomerId: customerId,
        status: "ACTIVE",
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: false,
        trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      },
      create: {
        userId,
        planId,
        stripeSubscriptionId: stripeSubId,
        stripeCustomerId: customerId,
        status: stripeSub.status === "trialing" ? "TRIALING" : "ACTIVE",
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: false,
        trialEnd: stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      },
    });

    // Upgrade user role
    await prisma.user.update({
      where: { id: userId },
      data: { role: "SUBSCRIBER" },
    });
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });
  if (!sub) return;

  const stripeSub = await stripe.subscriptions.retrieve(invoice.subscription as string);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return;
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "PAST_DUE" },
  });
}

async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: mapStripeStatus(stripeSub.status) as SubscriptionStatus,
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
    },
  });
}

async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  const sub = await prisma.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });
  if (!sub) return;

  await prisma.subscription.update({
    where: { id: sub.id },
    data: { status: "CANCELED", canceledAt: new Date() },
  });

  // Downgrade role
  await prisma.user.update({
    where: { id: sub.userId },
    data: { role: "USER" },
  });
}

function mapStripeStatus(status: string): string {
  const map: Record<string, string> = {
    active: "ACTIVE",
    trialing: "TRIALING",
    past_due: "PAST_DUE",
    canceled: "CANCELED",
    incomplete: "INCOMPLETE",
  };
  return map[status] ?? "ACTIVE";
}
