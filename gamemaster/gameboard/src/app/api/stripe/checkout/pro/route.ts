import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, getBaseUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.isPro) return NextResponse.json({ error: "Already Pro" }, { status: 400 });

  const base = getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer: user.stripeCustomerId ?? undefined,
    customer_email: user.stripeCustomerId ? undefined : (user.email ?? undefined),
    line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
    subscription_data: {
      metadata: { userId: session.user.id },
    },
    metadata: {
      type: "pro_subscription",
      userId: session.user.id,
    },
    success_url: `${base}/pro?subscribed=1`,
    cancel_url: `${base}/pro`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
