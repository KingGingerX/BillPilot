import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { sendQuestJoinEmail } from "@/lib/email";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionActive(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { type, questId, userId, promotionLevel } = session.metadata ?? {};

  if (type === "quest_join" && questId && userId) {
    await completeQuestJoin(questId, userId, session.amount_total ?? 0, session.id);
  }

  if (type === "quest_promotion" && questId && promotionLevel) {
    await prisma.quest.update({
      where: { id: questId },
      data: { promoted: promotionLevel as "FEATURED" | "HIGHLIGHTED" },
    });
  }

  if (type === "pro_subscription" && userId && session.customer) {
    const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
    await prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId, isPro: true },
    });
  }
}

async function completeQuestJoin(
  questId: string,
  userId: string,
  amountPaid: number,
  sessionId: string
) {
  const existing = await prisma.questParticipant.findUnique({
    where: { questId_userId: { questId, userId } },
  });
  if (existing) return;

  const quest = await prisma.quest.findUnique({
    where: { id: questId },
    include: { creator: { select: { email: true, name: true } } },
  });
  if (!quest) return;

  const feeConfig = await prisma.feeConfig.findFirst();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true, name: true },
  });
  const rakePercent = user?.isPro
    ? (feeConfig?.proRakePercent ?? 7)
    : (feeConfig?.rakePercent ?? 10);
  const feeAmount = Math.round(amountPaid * (rakePercent / 100));
  const netAmount = amountPaid - feeAmount;
  const allSlotsFilled = quest.filledSlots + 1 >= quest.maxSlots;

  await prisma.$transaction([
    prisma.questParticipant.create({
      data: { questId, userId, amountPaid, status: "PAID" },
    }),
    prisma.quest.update({
      where: { id: questId },
      data: {
        filledSlots: { increment: 1 },
        status: allSlotsFilled ? "IN_PROGRESS" : "OPEN",
      },
    }),
    prisma.transaction.create({
      data: {
        questId,
        payerId: userId,
        stripePaymentIntentId: sessionId,
        amount: amountPaid,
        feeAmount,
        netAmount,
        status: "HELD",
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { totalSpent: { increment: amountPaid }, xp: { increment: 5 } },
    }),
  ]);

  if (quest.creator.email) {
    await sendQuestJoinEmail(
      quest.creator.email,
      quest.creator.name ?? "Creator",
      quest.title,
      user?.name ?? "A player",
      amountPaid
    );
  }
}

async function handleSubscriptionActive(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) return;
  await prisma.user.update({
    where: { id: userId },
    data: {
      isPro: true,
      proSubscriptionId: subscription.id,
      stripeCustomerId:
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id,
    },
  });
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { isPro: false, proSubscriptionId: null },
    });
    return;
  }
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: { isPro: false, proSubscriptionId: null },
  });
}

async function handleInvoiceFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (
    invoice as unknown as { subscription?: string | { id: string } }
  ).subscription;
  if (!subscriptionId) return;
  const subId =
    typeof subscriptionId === "string" ? subscriptionId : subscriptionId.id;
  await prisma.user.updateMany({
    where: { proSubscriptionId: subId },
    data: { isPro: false },
  });
}
