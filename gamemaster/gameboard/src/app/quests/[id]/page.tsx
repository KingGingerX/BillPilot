import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { JoinQuestButton, PromoteQuestButton } from "@/components/payment-buttons";
import { CheckCircle, Clock, Shield, Swords, TrendingUp, Trophy, User, Zap } from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  SERVICE: <Zap className="h-4 w-4" />,
  CHALLENGE: <Trophy className="h-4 w-4" />,
  ITEM: <Swords className="h-4 w-4" />,
  BET: <TrendingUp className="h-4 w-4" />,
  EXPERIENCE: <User className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  SERVICE: "bg-yellow-500/20 text-yellow-300",
  CHALLENGE: "bg-primary/20 text-primary",
  ITEM: "bg-accent/20 text-accent",
  BET: "bg-green-500/20 text-green-300",
  EXPERIENCE: "bg-pink-500/20 text-pink-300",
};

export default async function QuestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ payment_success?: string; session_id?: string; promotion_success?: string }>;
}) {
  const { id } = await params;
  const { payment_success, session_id, promotion_success } = await searchParams;
  const session = await auth();

  // Verify Stripe checkout and record the join on success redirect
  if (payment_success === "1" && session_id && session) {
    const existing = await prisma.questParticipant.findUnique({
      where: { questId_userId: { questId: id, userId: session.user.id } },
    });
    if (!existing) {
      try {
        const checkoutSession = await stripe.checkout.sessions.retrieve(session_id);
        if (
          checkoutSession.payment_status === "paid" &&
          checkoutSession.metadata?.questId === id &&
          checkoutSession.metadata?.userId === session.user.id
        ) {
          const quest = await prisma.quest.findUnique({ where: { id } });
          if (quest) {
            const feeConfig = await prisma.feeConfig.findFirst();
            const user = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { isPro: true },
            });
            const rakePercent = user?.isPro
              ? (feeConfig?.proRakePercent ?? 7)
              : (feeConfig?.rakePercent ?? 10);
            const amountPaid = checkoutSession.amount_total ?? quest.price;
            const feeAmount = Math.round(amountPaid * (rakePercent / 100));
            const netAmount = amountPaid - feeAmount;
            const allSlotsFilled = quest.filledSlots + 1 >= quest.maxSlots;

            await prisma.$transaction([
              prisma.questParticipant.create({
                data: { questId: id, userId: session.user.id, amountPaid, status: "PAID" },
              }),
              prisma.quest.update({
                where: { id },
                data: {
                  filledSlots: { increment: 1 },
                  status: allSlotsFilled ? "IN_PROGRESS" : "OPEN",
                },
              }),
              prisma.transaction.create({
                data: {
                  questId: id,
                  payerId: session.user.id,
                  stripePaymentIntentId:
                    (checkoutSession.payment_intent as string) ?? session_id,
                  amount: amountPaid,
                  feeAmount,
                  netAmount,
                  status: "HELD",
                },
              }),
              prisma.user.update({
                where: { id: session.user.id },
                data: { totalSpent: { increment: amountPaid }, xp: { increment: 5 } },
              }),
            ]);
          }
        }
      } catch {
        // Verification failed silently — page loads normally
      }
    }
    redirect(`/quests/${id}`);
  }

  const quest = await prisma.quest.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, name: true, reputation: true, level: true, xp: true },
      },
      participants: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  if (!quest) notFound();

  const hasJoined = quest.participants.some((p) => p.userId === session?.user?.id);
  const isCreator = quest.creatorId === session?.user?.id;
  const isFull = quest.filledSlots >= quest.maxSlots;
  const isOpen = quest.status === "OPEN";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {promotion_success === "1" && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400">
          <CheckCircle className="h-5 w-5 shrink-0" />
          Quest promoted successfully — your listing is now featured.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main quest info */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={`${typeColors[quest.type]} border-transparent`}
                >
                  <span className="mr-1">{typeIcons[quest.type]}</span>
                  {quest.type}
                </Badge>
                <Badge variant="secondary">{quest.category}</Badge>
                {quest.promoted !== "NONE" && (
                  <Badge variant="gold">{quest.promoted}</Badge>
                )}
              </div>
              <CardTitle className="text-3xl">{quest.title}</CardTitle>
              <CardDescription className="text-base">
                Posted by{" "}
                <Link
                  href={`/player/${quest.creator.id}`}
                  className="text-primary hover:underline"
                >
                  {quest.creator.name ?? "Anonymous"}
                </Link>{" "}
                • Level {quest.creator.level} • Rep {quest.creator.reputation}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="whitespace-pre-line text-foreground">{quest.description}</p>
              {quest.rules && (
                <div className="rounded-lg border border-border/50 bg-secondary/50 p-4">
                  <h3 className="mb-2 font-semibold">Rules / Requirements</h3>
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {quest.rules}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {quest.deadline
                    ? `Deadline: ${new Date(quest.deadline).toLocaleString()}`
                    : "No deadline"}
                </div>
                <div>{quest.filledSlots} / {quest.maxSlots} slots filled</div>
                <div>Status: {quest.status}</div>
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Players Joined</CardTitle>
            </CardHeader>
            <CardContent>
              {quest.participants.length === 0 ? (
                <p className="text-muted-foreground">No players have joined yet.</p>
              ) : (
                <div className="space-y-2">
                  {quest.participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 p-3"
                    >
                      <span className="font-medium">{p.user.name ?? "Anonymous"}</span>
                      <Badge variant="outline">{p.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar action */}
        <div className="space-y-4">
          <Card className="border-border/50 bg-card/50 glow-border">
            <CardHeader>
              <CardTitle className="text-2xl">{formatCurrency(quest.price)}</CardTitle>
              <CardDescription>
                House rake ({Math.round((quest.feeAmount / quest.price) * 100)}%):{" "}
                {formatCurrency(quest.feeAmount)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!session ? (
                <Link href="/login">
                  <Button className="w-full bg-primary hover:bg-primary/90">
                    Log in to Join
                  </Button>
                </Link>
              ) : isCreator ? (
                <Button disabled className="w-full">
                  You created this quest
                </Button>
              ) : hasJoined ? (
                <Button disabled className="w-full">
                  <CheckCircle className="mr-2 h-4 w-4" />
                  You&apos;re in
                </Button>
              ) : isFull ? (
                <Button disabled className="w-full">
                  Quest is full
                </Button>
              ) : !isOpen ? (
                <Button disabled className="w-full">
                  Quest not open
                </Button>
              ) : (
                <JoinQuestButton
                  questId={quest.id}
                  price={formatCurrency(quest.price)}
                  label={`Join Quest — ${formatCurrency(quest.price)}`}
                />
              )}

              {/* Creator promotion buttons */}
              {isCreator && quest.promoted === "NONE" && quest.status === "OPEN" && (
                <div className="border-t border-border/50 pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground">Boost visibility:</p>
                  <PromoteQuestButton questId={quest.id} promotionLevel="FEATURED" label="Feature it — $5" />
                  <PromoteQuestButton questId={quest.id} promotionLevel="HIGHLIGHTED" label="Highlight it — $15" />
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  Funds held in escrow. Creator paid after completion minus the house rake.
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Creator card */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">About the Creator</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {(quest.creator.name ?? "?")[0]}
                </div>
                <div>
                  <p className="font-semibold">{quest.creator.name ?? "Anonymous"}</p>
                  <p className="text-sm text-muted-foreground">Level {quest.creator.level}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-secondary/50 p-2 text-center">
                  <div className="font-bold text-foreground">{quest.creator.reputation}</div>
                  <div className="text-xs text-muted-foreground">Reputation</div>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2 text-center">
                  <div className="font-bold text-foreground">{quest.creator.xp}</div>
                  <div className="text-xs text-muted-foreground">XP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
