import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isGameMaster = req.auth?.user?.role === "GAMEMASTER";

  const isGameMasterRoute = nextUrl.pathname.startsWith("/gamemaster");
  const isAuthRoute = ["/login", "/register"].includes(nextUrl.pathname);
  const isProtectedRoute =
    nextUrl.pathname.startsWith("/quests/new") ||
    nextUrl.pathname.startsWith("/profile") ||
    nextUrl.pathname.startsWith("/pro");

  if (isGameMasterRoute && !isGameMaster) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  if (isProtectedRoute && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|public).*)"],
};

