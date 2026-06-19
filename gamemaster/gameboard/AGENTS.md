<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# The Gameboard

A gamified peer-to-peer marketplace/arena. Players post Quests (services, challenges, items, bets, experiences), other players join and pay into escrow, and the Game Master (the house) takes a percentage rake on every transaction.

## Tech Stack
- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4 + custom dark theme
- Prisma 6 + SQLite (local dev)
- NextAuth.js v5 (Auth.js) with credentials provider
- Custom UI components in `src/components/ui`

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run db:migrate` — run Prisma migrations
- `npm run db:studio` — open Prisma Studio

## Seeding
POST to `/api/seed` (idempotent) to create:
- Default Game Master account: `gamemaster@gameboard.com` / `gamemaster123`
- Sample players and quests

## Key Files
- `src/lib/prisma.ts` — Prisma client singleton
- `src/auth.ts` — NextAuth configuration
- `src/middleware.ts` — route protection
- `src/app/gamemaster/page.tsx` — Game Master dashboard
- `src/app/quests/page.tsx` — Quest board
- `src/app/quests/new/page.tsx` — Create quest
- `src/app/quests/[id]/page.tsx` — Quest detail + join action

## Architecture Notes
- Server components fetch data via `auth()` and `prisma` directly.
- Server actions handle form submissions (auth, quest creation, joining).
- No real Stripe integration yet — escrow is simulated in the database.
- Financial amounts are stored as integers in cents.
