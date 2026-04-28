import { prisma } from "../db/client";
import { scoutReddit, scoutProductHunt, parseManualCsv } from "./sources";
import { ScoutResult } from "../models/types";
import { logger } from "../utils/logger";

// Niche configurations — customize these for your products
export const NICHES: Record<string, { subreddits: string[]; keywords: string[] }> = {
  "make-money-online": {
    subreddits: ["entrepreneur", "digitalnomad", "affiliatemarketing", "passive_income"],
    keywords: ["make money online", "passive income blog", "affiliate marketing"],
  },
  "fitness": {
    subreddits: ["fitness", "bodyweightfitness", "loseit", "workout"],
    keywords: ["fitness blog", "workout program review", "nutrition tips"],
  },
  "tech-tools": {
    subreddits: ["startups", "SideProject", "webdev", "productivity"],
    keywords: ["saas review blog", "productivity tools", "software review"],
  },
  "personal-finance": {
    subreddits: ["personalfinance", "financialindependence", "frugal"],
    keywords: ["personal finance blog", "budgeting tips", "savings"],
  },
};

export async function runScout(niche?: string): Promise<number> {
  const nichesToScout = niche ? [niche] : Object.keys(NICHES);
  let totalFound = 0;

  for (const n of nichesToScout) {
    const cfg = NICHES[n];
    if (!cfg) continue;

    logger.info(`[scout] scouting niche: ${n}`);
    const results: ScoutResult[] = [];

    // Reddit scouting
    const redditResults = await scoutReddit(cfg.subreddits, n);
    results.push(...redditResults);
    logger.info(`[scout] reddit found ${redditResults.length} prospects`);

    // ProductHunt scouting
    const phResults = await scoutProductHunt(n);
    results.push(...phResults);

    // Save new prospects
    for (const prospect of results) {
      try {
        await prisma.prospect.upsert({
          where: { email: prospect.email },
          update: {
            followerCount: prospect.followerCount ?? undefined,
            score: prospect.score,
          },
          create: {
            name: prospect.name ?? null,
            email: prospect.email,
            handle: prospect.handle ?? null,
            platform: prospect.platform,
            niche: prospect.niche ?? null,
            followerCount: prospect.followerCount ?? null,
            website: prospect.website ?? null,
            score: prospect.score,
          },
        });
        totalFound++;
      } catch {
        // duplicate email — skip
      }
    }
  }

  logger.info(`[scout] completed — ${totalFound} prospects saved`);
  return totalFound;
}

export async function importProspects(csvText: string, niche: string): Promise<number> {
  const results = parseManualCsv(csvText, niche);
  let saved = 0;

  for (const prospect of results) {
    try {
      await prisma.prospect.upsert({
        where: { email: prospect.email },
        update: {},
        create: {
          name: prospect.name ?? null,
          email: prospect.email,
          handle: prospect.handle ?? null,
          platform: prospect.platform,
          niche: prospect.niche ?? null,
          followerCount: prospect.followerCount ?? null,
          website: prospect.website ?? null,
          score: prospect.score,
        },
      });
      saved++;
    } catch {
      // skip duplicates
    }
  }

  logger.info(`[scout] imported ${saved} prospects from CSV`);
  return saved;
}

export async function approveProspect(prospectId: string): Promise<string> {
  const prospect = await prisma.prospect.findUniqueOrThrow({ where: { id: prospectId } });

  // Generate unique code
  let code: string;
  let attempts = 0;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const conflict = await prisma.affiliate.findUnique({ where: { code } });
    if (!conflict) break;
  } while (++attempts < 20);

  const affiliate = await prisma.affiliate.create({
    data: {
      prospectId,
      name: prospect.name ?? prospect.handle ?? prospect.email.split("@")[0],
      email: prospect.email,
      code: code!,
    },
  });

  await prisma.prospect.update({ where: { id: prospectId }, data: { status: "APPROVED" } });

  logger.info(`[scout] approved ${prospect.email} as affiliate ${affiliate.code}`);
  return affiliate.code;
}
