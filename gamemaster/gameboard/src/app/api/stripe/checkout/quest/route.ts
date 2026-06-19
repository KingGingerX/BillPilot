import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe, getBaseUrl } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { questId } = await req.json();
  if (!questId) return NextResponse.json({ error: "questId required" }, { status: 400 });

  const quest = await prisma.quest.findUnique({ where: { id: questId } });
  if (!quest) return NextResponse.json({ error: "Quest not found" }, { status: 404 });
  if (quest.status !== "OPEN") return NextResponse.json({ error: "Quest not open" }, { status: 400 });
  if (quest.filledSlots >= quest.maxSlots) return NextResponse.json({ error: "Quest full" }, { status: 400 });
  if (quest.creatorId === session.user.id) return NextResponse.json({ error: "Cannot join own quest" }, { status: 400 });

  const existing = await prisma.questParticipant.findUnique({
    where: { questId_userId: { questId, userId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "Already joined" }, { status: 400 });

  const base = getBaseUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: quest.price,
          product_data: {
            name: quest.title,
            description: `Join quest: ${quest.description.slice(0, 200)}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "quest_join",
      questId: quest.id,
      userId: session.user.id,
    },
    success_url: `${base}/quests/${quest.id}?payment_success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/quests/${quest.id}`,
  });

  return NextResponse.json({ url: checkoutSession.url });
}
