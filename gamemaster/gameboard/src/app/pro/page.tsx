import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscribeProButton } from "@/components/payment-buttons";
import { CheckCircle, Crown, Percent, Zap } from "lucide-react";

export default async function ProPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string }>;
}) {
  const { subscribed } = await searchParams;
  const session = await auth();

  let isPro = false;
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isPro: true },
    });
    isPro = user?.isPro ?? false;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {subscribed === "1" && (
        <div className="mb-8 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-green-400">
          <CheckCircle className="h-5 w-5 shrink-0" />
          You&apos;re now a Pro Player! Your reduced rake is active immediately.
        </div>
      )}

      <div className="mb-12 text-center">
        <Badge variant="gold" className="mb-4 px-4 py-1 text-sm">
          <Crown className="mr-2 h-4 w-4" />
          Pro Player
        </Badge>
        <h1 className="mb-4 text-4xl font-extrabold tracking-tight">
          The house cuts you a deal
        </h1>
        <p className="text-xl text-muted-foreground">
          Pro Players pay 7% rake instead of 10%. On high-value quests, it pays for itself instantly.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-12">
        <Card className="border-border/50 bg-card/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-muted-foreground">
              Standard Player
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-muted-foreground" />
              10% house rake on every transaction
            </div>
            <div className="text-muted-foreground">
              $1,000 quest → you keep $900
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/30 bg-primary/5 glow-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Crown className="h-5 w-5" />
              Pro Player — $19/mo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              7% house rake (save 3% on every transaction)
            </div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-accent" />
              Pro badge on your profile
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-400" />
              Priority dispute resolution
            </div>
            <div className="mt-4 rounded-lg bg-primary/10 p-3 text-primary font-medium">
              $1,000 quest → you keep $930 (+$30 vs standard)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="text-center">
        {!session ? (
          <Link href="/login">
            <Button size="lg" className="bg-primary px-8 text-lg hover:bg-primary/90">
              Log in to Upgrade
            </Button>
          </Link>
        ) : isPro ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-primary">
              <Crown className="h-6 w-6" />
              You&apos;re already a Pro Player
            </div>
            <p className="text-sm text-muted-foreground">
              Your 7% rake is active. Manage your subscription in Stripe.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <SubscribeProButton />
            <p className="text-xs text-muted-foreground">
              Cancel anytime. Rake reverts to 10% on cancellation.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
