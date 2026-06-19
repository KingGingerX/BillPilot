import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, Star, Flame } from "lucide-react";

export default async function LeaderboardPage() {
  const topEarners = await prisma.user.findMany({
    orderBy: { totalEarnings: "desc" },
    take: 10,
    select: { id: true, name: true, totalEarnings: true, level: true, reputation: true },
  });

  const topSpenders = await prisma.user.findMany({
    orderBy: { totalSpent: "desc" },
    take: 10,
    select: { id: true, name: true, totalSpent: true, level: true, reputation: true },
  });

  const topCreators = await prisma.user.findMany({
    orderBy: { questsCreated: "desc" },
    take: 10,
    select: { id: true, name: true, questsCreated: true, level: true, reputation: true },
  });

  const topXP = await prisma.user.findMany({
    orderBy: { xp: "desc" },
    take: 10,
    select: { id: true, name: true, xp: true, level: true, reputation: true },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboards</h1>
        <p className="text-muted-foreground">The best players on The Gameboard.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <LeaderboardCard
          title="Top Earners"
          icon={<TrendingUp className="h-5 w-5 text-green-400" />}
          users={topEarners}
          valueKey="totalEarnings"
          format={(v) => `$${(v as number / 100).toLocaleString()}`}
        />
        <LeaderboardCard
          title="Top Spenders"
          icon={<Flame className="h-5 w-5 text-orange-400" />}
          users={topSpenders}
          valueKey="totalSpent"
          format={(v) => `$${(v as number / 100).toLocaleString()}`}
        />
        <LeaderboardCard
          title="Most Quests Created"
          icon={<Trophy className="h-5 w-5 text-yellow-400" />}
          users={topCreators}
          valueKey="questsCreated"
          format={(v) => `${v} quests`}
        />
        <LeaderboardCard
          title="Highest XP"
          icon={<Star className="h-5 w-5 text-primary" />}
          users={topXP}
          valueKey="xp"
          format={(v) => `${v} XP`}
        />
      </div>
    </div>
  );
}

function LeaderboardCard({
  title,
  icon,
  users,
  valueKey,
  format,
}: {
  title: string;
  icon: React.ReactNode;
  users: any[];
  valueKey: string;
  format: (value: unknown) => string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="flex flex-row items-center gap-2">
        {icon}
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {users.map((user, index) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-border/50 p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0
                      ? "bg-yellow-500/20 text-yellow-300"
                      : index === 1
                      ? "bg-zinc-400/20 text-zinc-300"
                      : index === 2
                      ? "bg-orange-700/20 text-orange-400"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {index + 1}
                </div>
                <div>
                  <p className="font-medium">{user.name ?? "Anonymous"}</p>
                  <p className="text-xs text-muted-foreground">
                    Lv.{user.level} • Rep {user.reputation}
                  </p>
                </div>
              </div>
              <Badge variant="outline">{format(user[valueKey])}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
