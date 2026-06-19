import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { signOut } from "@/auth";
import { Star, Swords, Wallet, Trophy } from "lucide-react";

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      quests: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
      participations: {
        orderBy: { joinedAt: "desc" },
        take: 5,
        include: { quest: { select: { title: true, id: true, status: true } } },
      },
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl font-bold text-primary">
            {(user.name ?? "?")[0]}
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.name ?? "Anonymous"}</h1>
            <p className="text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex gap-2">
              <Badge variant="secondary">Level {user.level}</Badge>
              <Badge variant="accent">{user.reputation} Rep</Badge>
              {user.role === "GAMEMASTER" && (
                <Badge variant="gold">Game Master</Badge>
              )}
            </div>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="outline" type="submit">
            Log out
          </Button>
        </form>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Earnings" value={formatCurrency(user.totalEarnings)} />
        <StatCard icon={<Wallet className="h-5 w-5" />} label="Total Spent" value={formatCurrency(user.totalSpent)} />
        <StatCard icon={<Swords className="h-5 w-5" />} label="Quests Created" value={user.questsCreated.toString()} />
        <StatCard icon={<Trophy className="h-5 w-5" />} label="XP" value={user.xp.toString()} />
      </div>

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
