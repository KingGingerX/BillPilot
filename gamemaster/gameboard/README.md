# The Gameboard

> A gamified peer-to-peer marketplace where the house always wins.

The Gameboard is a platform for quests, challenges, bets, services, items, and experiences. Players transact directly with each other; the Game Master (you) takes a percentage of every transaction.

## Features

- **Quest Board** — Browse, filter, and join active quests.
- **Quest Creation** — Post services, challenges, items, bets, or experiences.
- **Escrow Engine** — Simulated escrow with automatic house rake.
- **Game Master Dashboard** — Configure fees, view GMV, and monitor transactions.
- **Leaderboards** — Top earners, spenders, creators, and XP.
- **Authentication** — Email/password login powered by NextAuth.js.

## Tech Stack

- Next.js 16 App Router + React 19 + TypeScript
- Tailwind CSS v4 + custom dark UI components
- Prisma 6 + SQLite
- NextAuth.js v5

## Getting Started

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Default Game Master Account

After seeding, log in as the Game Master:

- Email: `gamemaster@gameboard.com`
- Password: `gamemaster123`

### Default Sample Players

- `aria@example.com` / `password123`
- `kai@example.com` / `password123`
- `nova@example.com` / `password123`

## Business Model

The platform does not sell anything directly. Revenue comes from:

- **House rake** on every completed transaction (default 10%)
- **Featured / highlighted listings**
- **Escrow expedite fees**
- **Withdrawal fees**
- **Pro Player subscriptions** (reduced rake)

Configure all fees from the Game Master dashboard.

## Folder Structure

```
src/
  app/              # Next.js App Router pages
  components/ui/    # Custom UI components
  lib/              # Prisma client, seed, utils
  auth.ts           # NextAuth configuration
  middleware.ts     # Route protection
```

## Deployment

Deploy to Vercel (or any Next.js host). For production, switch from SQLite to PostgreSQL and configure OAuth providers in `src/auth.ts`.
