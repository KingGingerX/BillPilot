import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export async function POST(req: Request) {
  const adminKey = req.headers.get("x-admin-key");
  if (adminKey !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await seedDatabase();
  return NextResponse.json(result);
}
