import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { sendWithdrawalRequestEmail } from "@/lib/email";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { signOut } from "@/auth";
import { ArrowDownToLine, Crown, Star, Swords, Trophy, Wallet } from "lucide-react";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ withdrawal?: string }>;
}) {
  const { withdrawal } = await searchParams;
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      quests: { orderBy: { createdAt: "desc" }, take: 5 },
      participations: {
        orderBy: { joinedAt: "desc" },
        take: 5,
        include: { quest: { select: { title: true, id: true, status: true } } },
      },
      withdrawalRequests: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  if (!user) redirect("/login");

  const feeConfig = await prisma.feeConfig.findFirst();
  const withdrawalFeePercent = feeConfig?.withdrawalPercent ?? 2;
  const withdrawalMin = feeConfig?.withdrawalMin ?? 100;

  const availableBalance = user.totalEarnings;
  const canWithdraw = availableBalance >= withdrawalMin;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {withdrawal === "requested" && (
        <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400 text-sm">
          Withdrawal request submitted. The Game Master will process it shortly.
        </div>
      )}
      {withdrawal === "too_low" && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          Amount is below the minimum withdrawal of {formatCurrency(withdrawalMin)}.
        </div>
      )}
      {withdrawal === "exceeds_balance" && (
        <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive text-sm">
          Amount exceeds available balance.
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
            {(user.name ?? "?")[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.name ?? "Anonymous"}</h1>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="secondary">Level {user.level}</Badge>
              <Badge variant="accent">{user.reputation} Rep</Badge>
              {user.isPro && <Badge variant="gold">Pro Player</Badge>}
              {user.role === "GAMEMASTER" && <Badge variant="gold">Game Master</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {user.role === "GAMEMASTER" && (
            <Link href="/gamemaster">
              <Button variant="outline" className="w-full">
                GM Dashboard
              </Button>
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button variant="outline" type="submit" className="w-full">
              Log out
            </Button>
          </form>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Available Balance"
          value={formatCurrency(availableBalance)}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="Total Spent"
          value={formatCurrency(user.totalSpent)}
        />
        <StatCard
          icon={<Swords className="h-5 w-5" />}
          label="Quests Created"
          value={user.questsCreated.toString()}
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="XP"
          value={user.xp.toString()}
        />
      </div>

      {/* Withdrawal panel */}
      <Card className="mb-6 border-accent/30 bg-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-accent" />
            Withdraw Earnings
          </CardTitle>
          <CardDescription>
            Balance: {formatCurrency(availableBalance)} — {withdrawalFeePercent}% fee applies.
            Minimum: {formatCurrency(withdrawalMin)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canWithdraw ? (
            <p className="text-sm text-muted-foreground">
              Minimum balance of {formatCurrency(withdrawalMin)} required to withdraw.
            </p>
          ) : (
            <form
              action={async (formData) => {
                "use server";
                const s = await auth();
                if (!s) redirect("/login");

                const rawAmount = parseFloat(formData.get("amount") as string);
                const amountCents = Math.round(rawAmount * 100);
                const notes = (formData.get("notes") as string)?.trim() || null;

                const currentUser = await prisma.user.findUnique({
                  where: { id: s.user.id },
                  select: { totalEarnings: true, email: true, name: true },
                });
                if (!currentUser) redirect("/profile");

                const config = await prisma.feeConfig.findFirst();
                const minWithdrawal = config?.withdrawalMin ?? 100;
                const feePercent = config?.withdrawalPercent ?? 2;

                if (amountCents < minWithdrawal) redirect("/profile?withdrawal=too_low");
                if (amountCents > currentUser.totalEarnings)
                  redirect("/profile?withdrawal=exceeds_balance");

                const feeAmount = Math.round(amountCents * (feePercent / 100));

                await prisma.$transaction([
                  prisma.withdrawalRequest.create({
                    data: {
                      userId: s.user.id,
                      amount: amountCents,
                      feeAmount,
                      notes,
                    },
                  }),
                  prisma.user.update({
                    where: { id: s.user.id },
                    data: { totalEarnings: { decrement: amountCents } },
                  }),
                ]);

                // Notify GM
                const gmUser = await prisma.user.findFirst({
                  where: { role: "GAMEMASTER" },
                  select: { email: true },
                });
                if (gmUser?.email) {
                  await sendWithdrawalRequestEmail(
                    gmUser.email,
                    currentUser.name ?? "A player",
                    amountCents
                  );
                }

                redirect("/profile?withdrawal=requested");
              }}
              className="flex flex-wrap items-end gap-4"
            >
              <div className="space-y-1.5 min-w-36">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min={(withdrawalMin / 100).toFixed(2)}
                  max={(availableBalance / 100).toFixed(2)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="flex-1 space-y-1.5 min-w-48">
                <Label htmlFor="notes">Payment note (optional)</Label>
                <Textarea id="notes" name="notes" rows={1} placeholder="e.g. PayPal: you@email.com" />
              </div>
              <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                Request Withdrawal
              </Button>
            </form>
          )}

          {/* Withdrawal history */}
          {user.withdrawalRequests.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Recent withdrawals</p>
              {user.withdrawalRequests.map((wr) => (
                <div
                  key={wr.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 text-sm"
                >
                  <div>
                    <span className="font-medium">{formatCurrency(wr.amount)}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      (fee {formatCurrency(wr.feeAmount)}) •{" "}
                      {new Date(wr.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <Badge
                    variant={
                      wr.status === "COMPLETED"
                        ? "default"
                        : wr.status === "REJECTED"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {wr.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pro upsell if not subscribed */}
      {!user.isPro && (
        <Card className="mb-6 border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <Crown className="h-6 w-6 text-yellow-400" />
              <div>
                <p className="font-medium">Upgrade to Pro Player</p>
                <p className="text-xs text-muted-foreground">
                  Pay only 7% rake instead of 10% — $19/mo
                </p>
              </div>
            </div>
            <Link href="/pro">
              <Button size="sm" className="bg-yellow-500 hover:bg-yellow-400 text-black">
                Go Pro
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-primary" />
              My Quests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.quests.length === 0 ? (
              <p className="text-muted-foreground">No quests created yet.</p>
            ) : (
              <div className="space-y-2">
                {user.quests.map((q) => (
                  <a
                    key={q.id}
                    href={`/quests/${q.id}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-secondary/50"
                  >
                    <span className="font-medium">{q.title}</span>
                    <Badge variant="outline">{q.status}</Badge>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-accent" />
              Joined Quests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {user.participations.length === 0 ? (
              <p className="text-muted-foreground">No quests joined yet.</p>
            ) : (
              <div className="space-y-2">
                {user.participations.map((p) => (
                  <a
                    key={p.id}
                    href={`/quests/${p.questId}`}
                    className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-secondary/50"
                  >
                    <span className="font-medium">{p.quest.title}</span>
                    <Badge variant="outline">{p.status}</Badge>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="flex items-center gap-4 p-6">
        <div className="text-primary">{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
