import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Star, Swords, Trophy, Wallet } from "lucide-react";
import Link from "next/link";

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      quests: {
        where: { status: { in: ["OPEN", "IN_PROGRESS", "COMPLETED"] } },
        orderBy: { createdAt: "desc" },
        take: 6,
      },
    },
  });

  if (!user) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-6">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-4xl font-bold text-primary">
          {(user.name ?? "?")[0]}
        </div>
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{user.name ?? "Anonymous"}</h1>
            {user.role === "GAMEMASTER" && <Badge variant="gold">Game Master</Badge>}
            {user.isPro && (
              <Badge variant="gold">
                <Crown className="mr-1 h-3 w-3" />
                Pro
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Level {user.level}</Badge>
            <Badge variant="accent">{user.reputation} Rep</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Member since {user.createdAt.toLocaleDateString()}
          </p>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Earned" value={formatCurrency(user.totalEarnings)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Spent" value={formatCurrency(user.totalSpent)} />
        <StatCard icon={<Swords className="h-5 w-5" />} label="Quests Created" value={user.questsCreated.toString()} />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="XP" value={user.xp.toString()} />
      </div>

      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary" />
            Active Quests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.quests.length === 0 ? (
            <p className="text-muted-foreground">No active quests.</p>
          ) : (
            <div className="space-y-2">
              {user.quests.map((q) => (
                <Link
                  key={q.id}
                  href={`/quests/${q.id}`}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-3 hover:bg-secondary/50 transition-colors"
                >
                  <span className="font-medium">{q.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{formatCurrency(q.price)}</span>
                    <Badge variant="outline">{q.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
