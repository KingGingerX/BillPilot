import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { sendEscrowReleasedEmail, sendWithdrawalRequestEmail } from "@/lib/email";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  CheckCircle,
  Coins,
  Crown,
  LayoutDashboard,
  Swords,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

export default async function GameMasterDashboard() {
  const session = await auth();
  if (session?.user?.role !== "GAMEMASTER") redirect("/");

  const totalQuests = await prisma.quest.count();
  const openQuests = await prisma.quest.count({ where: { status: "OPEN" } });
  const totalUsers = await prisma.user.count();
  const proUsers = await prisma.user.count({ where: { isPro: true } });

  const aggregations = await prisma.transaction.aggregate({
    _sum: { amount: true, feeAmount: true, netAmount: true },
  });

  const heldTransactions = await prisma.transaction.findMany({
    where: { status: "HELD" },
    orderBy: { createdAt: "desc" },
    include: {
      quest: {
        select: {
          id: true,
          title: true,
          status: true,
          creatorId: true,
          creator: { select: { name: true, email: true } },
        },
      },
      payer: { select: { name: true } },
    },
  });

  const recentReleased = await prisma.transaction.findMany({
    where: { status: "RELEASED" },
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: {
      quest: { select: { title: true } },
      payer: { select: { name: true } },
    },
  });

  const openDisputes = await prisma.dispute.findMany({
    where: { status: { in: ["OPEN", "UNDER_REVIEW"] } },
    include: {
      quest: { select: { title: true, id: true } },
      filer: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const pendingWithdrawals = await prisma.withdrawalRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true, email: true } } },
  });

  let feeConfig = await prisma.feeConfig.findFirst();
  if (!feeConfig) {
    feeConfig = await prisma.feeConfig.create({ data: {} });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <LayoutDashboard className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Game Master Dashboard</h1>
          <p className="text-muted-foreground">
            Configure fees, release escrow, and manage the arena.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Coins className="h-5 w-5 text-primary" />}
          label="Total GMV"
          value={formatCurrency(aggregations._sum.amount ?? 0)}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-accent" />}
          label="House Rake Collected"
          value={formatCurrency(aggregations._sum.feeAmount ?? 0)}
        />
        <StatCard
          icon={<Swords className="h-5 w-5 text-yellow-400" />}
          label="Active Quests"
          value={`${openQuests} / ${totalQuests}`}
        />
        <StatCard
          icon={<Users className="h-5 w-5 text-pink-400" />}
          label="Players"
          value={`${totalUsers} total`}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <StatCard
          icon={<Crown className="h-5 w-5 text-yellow-300" />}
          label="Pro Players"
          value={`${proUsers} subscribed`}
        />
        <StatCard
          icon={<Wallet className="h-5 w-5 text-green-400" />}
          label="Funds in Escrow"
          value={formatCurrency(heldTransactions.reduce((s, t) => s + t.amount, 0))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Fee configuration */}
        <Card className="border-border/50 bg-card/50 lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Fee Configuration
            </CardTitle>
            <CardDescription>Adjust house take from every transaction.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={async (formData) => {
                "use server";
                if ((await auth())?.user?.role !== "GAMEMASTER") redirect("/");

                const data = {
                  rakePercent: parseInt(formData.get("rakePercent") as string),
                  listingFeatured: Math.round(
                    parseFloat(formData.get("listingFeatured") as string) * 100
                  ),
                  listingHighlighted: Math.round(
                    parseFloat(formData.get("listingHighlighted") as string) * 100
                  ),
                  expediteFee: Math.round(
                    parseFloat(formData.get("expediteFee") as string) * 100
                  ),
                  withdrawalPercent: parseInt(
                    formData.get("withdrawalPercent") as string
                  ),
                  withdrawalMin: Math.round(
                    parseFloat(formData.get("withdrawalMin") as string) * 100
                  ),
                  proPrice: Math.round(
                    parseFloat(formData.get("proPrice") as string) * 100
                  ),
                  proRakePercent: parseInt(formData.get("proRakePercent") as string),
                };

                const config = await prisma.feeConfig.findFirst();
                if (config) {
                  await prisma.feeConfig.update({ where: { id: config.id }, data });
                } else {
                  await prisma.feeConfig.create({ data });
                }
                redirect("/gamemaster");
              }}
              className="space-y-4"
            >
              <FeeInput
                label="Rake %"
                name="rakePercent"
                defaultValue={feeConfig.rakePercent}
                suffix="%"
              />
              <FeeInput
                label="Featured Listing"
                name="listingFeatured"
                defaultValue={feeConfig.listingFeatured / 100}
                prefix="$"
              />
              <FeeInput
                label="Highlighted Listing"
                name="listingHighlighted"
                defaultValue={feeConfig.listingHighlighted / 100}
                prefix="$"
              />
              <FeeInput
                label="Escrow Expedite"
                name="expediteFee"
                defaultValue={feeConfig.expediteFee / 100}
                prefix="$"
              />
              <FeeInput
                label="Withdrawal %"
                name="withdrawalPercent"
                defaultValue={feeConfig.withdrawalPercent}
                suffix="%"
              />
              <FeeInput
                label="Withdrawal Min"
                name="withdrawalMin"
                defaultValue={feeConfig.withdrawalMin / 100}
                prefix="$"
              />
              <FeeInput
                label="Pro Subscription"
                name="proPrice"
                defaultValue={feeConfig.proPrice / 100}
                prefix="$"
              />
              <FeeInput
                label="Pro Rake %"
                name="proRakePercent"
                defaultValue={feeConfig.proRakePercent}
                suffix="%"
              />
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
                Update Fees
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Escrow — funds held */}
        <Card className="border-border/50 bg-card/50 lg:col-span-2">
          <CardHeader>
            <CardTitle>Escrow — Held Funds</CardTitle>
            <CardDescription>
              {heldTransactions.length} transactions pending release.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {heldTransactions.length === 0 ? (
              <p className="text-muted-foreground">No funds currently held in escrow.</p>
            ) : (
              <div className="space-y-3">
                {heldTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 p-3"
                  >
                    <div>
                      <p className="font-medium">{tx.quest.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Payer: {tx.payer.name ?? "Unknown"} • Creator:{" "}
                        {tx.quest.creator.name ?? "Unknown"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(tx.netAmount)}</div>
                        <div className="text-xs text-muted-foreground">
                          to creator (+{formatCurrency(tx.feeAmount)} rake)
                        </div>
                      </div>
                      <form
                        action={async () => {
                          "use server";
                          if ((await auth())?.user?.role !== "GAMEMASTER") redirect("/");
                          await prisma.$transaction([
                            prisma.transaction.update({
                              where: { id: tx.id },
                              data: { status: "RELEASED" },
                            }),
                            prisma.quest.update({
                              where: { id: tx.questId },
                              data: { status: "COMPLETED" },
                            }),
                            prisma.user.update({
                              where: { id: tx.quest.creatorId },
                              data: {
                                totalEarnings: { increment: tx.netAmount },
                                questsCompleted: { increment: 1 },
                                xp: { increment: 20 },
                                reputation: { increment: 5 },
                              },
                            }),
                            prisma.questParticipant.updateMany({
                              where: { questId: tx.questId },
                              data: { status: "RELEASED" },
                            }),
                          ]);
                          if (tx.quest.creator.email) {
                            await sendEscrowReleasedEmail(
                              tx.quest.creator.email,
                              tx.quest.creator.name ?? "Creator",
                              tx.quest.title,
                              tx.netAmount
                            );
                          }
                          redirect("/gamemaster");
                        }}
                      >
                        <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-500">
                          <CheckCircle className="mr-1.5 h-4 w-4" />
                          Release
                        </Button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open disputes with resolution form */}
      {openDisputes.length > 0 && (
        <Card className="mt-6 border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Open Disputes ({openDisputes.length})
            </CardTitle>
            <CardDescription>Resolve or mark under review.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {openDisputes.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{d.quest.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Filed by <strong>{d.filer.name ?? "Unknown"}</strong> on{" "}
                      {new Date(d.createdAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm">{d.reason}</p>
                    {d.evidence && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Evidence: {d.evidence}
                      </p>
                    )}
                  </div>
                  <Badge variant="destructive">{d.status}</Badge>
                </div>
                <form
                  action={async (formData) => {
                    "use server";
                    if ((await auth())?.user?.role !== "GAMEMASTER") redirect("/");
                    const action = formData.get("action") as string;
                    const resolution = (formData.get("resolution") as string)?.trim();
                    if (action === "resolve") {
                      await prisma.dispute.update({
                        where: { id: d.id },
                        data: {
                          status: "RESOLVED",
                          resolution: resolution || "Resolved by Game Master",
                          resolvedAt: new Date(),
                        },
                      });
                    } else {
                      await prisma.dispute.update({
                        where: { id: d.id },
                        data: { status: "UNDER_REVIEW" },
                      });
                    }
                    redirect("/gamemaster");
                  }}
                  className="flex flex-wrap items-end gap-3"
                >
                  <div className="flex-1 min-w-48 space-y-1">
                    <Label htmlFor={`resolution-${d.id}`} className="text-xs">
                      Resolution note
                    </Label>
                    <Textarea
                      id={`resolution-${d.id}`}
                      name="resolution"
                      rows={2}
                      placeholder="Explain resolution..."
                      className="text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      name="action"
                      value="review"
                      size="sm"
                      variant="outline"
                    >
                      Mark Under Review
                    </Button>
                    <Button
                      type="submit"
                      name="action"
                      value="resolve"
                      size="sm"
                      className="bg-green-600 hover:bg-green-500"
                    >
                      Mark Resolved
                    </Button>
                  </div>
                </form>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pending withdrawals */}
      {pendingWithdrawals.length > 0 && (
        <Card className="mt-6 border-accent/30 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-accent" />
              Pending Withdrawals ({pendingWithdrawals.length})
            </CardTitle>
            <CardDescription>Approve or reject player withdrawal requests.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWithdrawals.map((wr) => (
              <div
                key={wr.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/40 p-4"
              >
                <div>
                  <p className="font-medium">{wr.user.name ?? "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{wr.user.email}</p>
                  <p className="text-sm">
                    Gross: {formatCurrency(wr.amount)} — Fee: {formatCurrency(wr.feeAmount)} —{" "}
                    <strong>Net: {formatCurrency(wr.amount - wr.feeAmount)}</strong>
                  </p>
                  {wr.notes && (
                    <p className="mt-1 text-xs text-muted-foreground">Note: {wr.notes}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      if ((await auth())?.user?.role !== "GAMEMASTER") redirect("/");
                      await prisma.withdrawalRequest.update({
                        where: { id: wr.id },
                        data: { status: "COMPLETED", processedAt: new Date() },
                      });
                      redirect("/gamemaster");
                    }}
                  >
                    <Button type="submit" size="sm" className="bg-green-600 hover:bg-green-500">
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                      Approve
                    </Button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      if ((await auth())?.user?.role !== "GAMEMASTER") redirect("/");
                      await prisma.$transaction([
                        prisma.withdrawalRequest.update({
                          where: { id: wr.id },
                          data: { status: "REJECTED", processedAt: new Date() },
                        }),
                        prisma.user.update({
                          where: { id: wr.userId },
                          data: { totalEarnings: { increment: wr.amount } },
                        }),
                      ]);
                      redirect("/gamemaster");
                    }}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Reject
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recently released */}
      {recentReleased.length > 0 && (
        <Card className="mt-6 border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle>Recently Released</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Quest</th>
                    <th className="pb-2 font-medium">Payer</th>
                    <th className="pb-2 font-medium">Amount</th>
                    <th className="pb-2 font-medium">Rake</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {recentReleased.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 pr-4">{tx.quest.title}</td>
                      <td className="py-3 pr-4">{tx.payer.name ?? "Unknown"}</td>
                      <td className="py-3 pr-4">{formatCurrency(tx.amount)}</td>
                      <td className="py-3 pr-4 text-accent">{formatCurrency(tx.feeAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
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
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FeeInput({
  label,
  name,
  defaultValue,
  prefix,
  suffix,
}: {
  label: string;
  name: string;
  defaultValue: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={name}
          name={name}
          type="number"
          step="0.01"
          defaultValue={defaultValue}
          required
          className={prefix ? "pl-7" : ""}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
