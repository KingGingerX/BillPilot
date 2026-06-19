import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, getBaseUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questId, promotionLevel } = await req.json();
  if (!questId || !promotionLevel) return NextResponse.json({ error: "questId and promotionLevel required" }, { status: 400 });
  if (!["FEATURED", "HIGHLIGHTED"].includes(promotionLevel)) {
    return NextResponse.json({ error: "Invalid promotionLevel" }, { status: 400 });
  }

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest) return NextResponse.json({ error: "Quest not found" }, { status: 404 });
  if (quest.creatorId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const priceId = promotionLevel === "FEATURED"
    ? process.env.STRIPE_PRICE_ID_FEATURED!
    : process.env.STRIPE_PRICE_ID_HIGHLIGHTED!;

  const base = getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      type: "quest_promotion",
      questId: quest.id,
      promotionLevel,
    },
    success_url: `${base}/quests/${quest.id}?promotion_success=1`,
    cancel_url: `${base}/quests/${quest.id}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
