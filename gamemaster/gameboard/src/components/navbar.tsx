import Link from "next/link";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Dice5, Crown, Plus, Shield, Swords, Trophy, User } from "lucide-react";

export async function Navbar() {
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
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 text-primary">
          <Dice5 className="h-7 w-7" />
          <span className="text-xl font-bold tracking-tight text-foreground">
            The Gameboard
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          <NavLink href="/quests" icon={<Swords className="h-4 w-4" />}>
            Quests
          </NavLink>
          <NavLink href="/leaderboard" icon={<Trophy className="h-4 w-4" />}>
            Leaderboard
          </NavLink>
          {session && !isPro && (
            <NavLink href="/pro" icon={<Crown className="h-4 w-4" />}>
              Go Pro
            </NavLink>
          )}
          {session?.user?.role === "GAMEMASTER" && (
            <NavLink href="/gamemaster" icon={<Shield className="h-4 w-4" />}>
              Game Master
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {session ? (
            <>
              <Link href="/quests/new">
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4" />
                  New Quest
                </Button>
              </Link>
              <Link href="/profile">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="outline" size="sm">
                  Log out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Log in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-primary hover:bg-primary/90">
                  Play Now
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
