import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  ShieldCheck,
  Swords,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border/50 px-4 py-24 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="relative mx-auto max-w-5xl text-center">
          <Badge variant="accent" className="mb-6">
            The house always wins
          </Badge>
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-foreground glow-text sm:text-6xl lg:text-7xl">
            Play anything. <br className="hidden sm:block" />
            Trade everything.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground sm:text-xl">
            The Gameboard is a gamified peer-to-peer arena. Post quests,
            accept challenges, sell goods, or make bets. Every move pays
            the Game Master.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-primary px-8 text-lg hover:bg-primary/90">
                Enter the Arena
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/quests">
              <Button size="lg" variant="outline" className="px-8 text-lg">
                Browse Quests
              </Button>
            </Link>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Active Quests" value="1,240+" />
            <Stat label="Players" value="8,500+" />
            <Stat label="GMV" value="$2.4M" />
            <Stat label="House Rake" value="10%" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight">
              How the Gameboard works
            </h2>
            <p className="text-muted-foreground">
              Create, compete, complete. The Game Master facilitates and takes a
              cut of every transaction.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <FeatureCard
              icon={<Swords className="h-8 w-8 text-primary" />}
              title="Post a Quest"
              description="Offer a service, set a challenge, sell an item, or open a bet. Set your price and rules."
            />
            <FeatureCard
              icon={<Users className="h-8 w-8 text-accent" />}
              title="Another Player Joins"
              description="Players discover your quest, pay into escrow, and lock in the game."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8 text-yellow-400" />}
              title="House Releases Funds"
              description="On completion, escrow releases. The house keeps its rake. You keep the rest."
            />
          </div>
        </div>
      </section>

      {/* Quest types */}
      <section className="border-y border-border/50 bg-secondary/30 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight">
              Quest types
            </h2>
            <p className="text-muted-foreground">
              Anything can become a quest. The Game Master doesn't discriminate.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <QuestTypeCard
              icon={<Zap className="h-6 w-6" />}
              title="Services"
              description="Freelance gigs, coaching, repairs, creative work."
            />
            <QuestTypeCard
              icon={<Trophy className="h-6 w-6" />}
              title="Challenges"
              description="Fitness bets, speedruns, dares, skill contests."
            />
            <QuestTypeCard
              icon={<TrendingUp className="h-6 w-6" />}
              title="Bets"
              description="Prediction markets, head-to-head wagers."
            />
            <QuestTypeCard
              icon={<Users className="h-6 w-6" />}
              title="Items"
              description="Digital goods, collectibles, physical products."
            />
            <QuestTypeCard
              icon={<ShieldCheck className="h-6 w-6" />}
              title="Experiences"
              description="Events, meetups, tours, unique moments."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center glow-border sm:p-12">
          <h2 className="mb-4 text-3xl font-bold tracking-tight">
            Ready to play?
          </h2>
          <p className="mb-8 text-muted-foreground">
            Sign up free. Post your first quest in under 60 seconds. The house
            is waiting.
          </p>
          <Link href="/register">
            <Button size="lg" className="bg-primary px-8 text-lg hover:bg-primary/90">
              Create Your Account
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur">
      <CardHeader>
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
}

function QuestTypeCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
