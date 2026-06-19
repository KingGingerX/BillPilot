import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect("/");

  const { error } = await searchParams;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border/50 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Join The Gameboard</CardTitle>
          <CardDescription>Create your player account.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {error === "email_taken"
                ? "That email is already registered. Log in instead."
                : "Something went wrong. Please try again."}
            </div>
          )}
          <form
            action={async (formData) => {
              "use server";
              const name = formData.get("name") as string;
              const email = formData.get("email") as string;
              const password = formData.get("password") as string;

              if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
                redirect("/register?error=invalid_input");
              }

              const existing = await prisma.user.findUnique({ where: { email } });
              if (existing) {
                redirect("/register?error=email_taken");
              }

              const hashed = await bcrypt.hash(password, 10);
              await prisma.user.create({
                data: { name: name.trim(), email, password: hashed },
              });

              await signIn("credentials", { email, password, redirectTo: "/" });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" name="name" type="text" placeholder="GameMaster99" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              Create Account
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already a player?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
