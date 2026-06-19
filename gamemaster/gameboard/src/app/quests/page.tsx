import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { Clock, Search, Swords, TrendingUp, Trophy, User, Zap } from "lucide-react";

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

export default async function QuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; category?: string; sort?: string }>;
}) {
  const { type, category, sort } = await searchParams;

  const quests = await prisma.quest.findMany({
    where: {
      status: "OPEN",
      ...(type && { type: type as any }),
      ...(category && { category }),
    },
    include: {
      creator: {
        select: { id: true, name: true, reputation: true, level: true },
      },
      _count: { select: { participants: true } },
    },
    orderBy: sort === "price" ? { price: "asc" } : { createdAt: "desc" },
  });

  const categories = await prisma.quest.groupBy({
    by: ["category"],
    _count: true,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Quest Board</h1>
          <p className="text-muted-foreground">
            Browse active quests. Join one and play the game.
          </p>
        </div>
        <Link href="/quests/new">
          <Button className="bg-primary hover:bg-primary/90">
            <Swords className="mr-2 h-4 w-4" />
            Post a Quest
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters */}
        <div className="space-y-4 lg:col-span-1">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-lg">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium">Quest Type</h4>
                <div className="flex flex-wrap gap-2">
                  <FilterBadge href="/quests" active={!type} label="All" />
                  {["SERVICE", "CHALLENGE", "ITEM", "BET", "EXPERIENCE"].map((t) => (
                    <FilterBadge
                      key={t}
                      href={`/quests?type=${t}`}
                      active={type === t}
                      label={t}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Categories</h4>
                <div className="flex flex-wrap gap-2">
                  <FilterBadge href="/quests" active={!category} label="All" />
                  {categories.map((c) => (
                    <FilterBadge
                      key={c.category}
                      href={`/quests?category=${encodeURIComponent(c.category)}`}
                      active={category === c.category}
                      label={c.category}
                    />
                  ))}
                </div>
              </div>
              <div>
                <h4 className="mb-2 text-sm font-medium">Sort</h4>
                <div className="flex flex-wrap gap-2">
                  <FilterBadge href="/quests" active={sort !== "price"} label="Newest" />
                  <FilterBadge
                    href="/quests?sort=price"
                    active={sort === "price"}
                    label="Lowest Price"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quest grid */}
        <div className="lg:col-span-3">
          {quests.length === 0 ? (
            <Card className="border-border/50 bg-card/50 py-12 text-center">
              <CardContent>
                <Search className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">No quests found</h3>
                <p className="text-muted-foreground">
                  Be the first to post a quest in this category.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {quests.map((quest) => (
                <Link key={quest.id} href={`/quests/${quest.id}`}>
                  <Card className="group h-full border-border/50 bg-card/50 transition-all hover:border-primary/50 hover:bg-card">
                    <CardHeader className="pb-3">
                      <div className="mb-2 flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`${typeColors[quest.type]} border-transparent`}
                        >
                          <span className="mr-1">{typeIcons[quest.type]}</span>
                          {quest.type}
                        </Badge>
                        {quest.promoted !== "NONE" && (
                          <Badge variant="gold">{quest.promoted}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {quest.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {quest.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-foreground">
                          {formatCurrency(quest.price)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {quest._count.participants}/{quest.maxSlots} joined
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/50 pt-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          {quest.creator.name ?? "Anonymous"}
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {quest.deadline
                            ? new Date(quest.deadline).toLocaleDateString()
                            : "No deadline"}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterBadge({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
}
