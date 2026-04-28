import axios from "axios";
import * as cheerio from "cheerio";
import { ScoutResult } from "../models/types";
import { logger } from "../utils/logger";
import { config } from "../config";

// ── Reddit Scouting ───────────────────────────────────────────

export async function scoutReddit(
  subreddits: string[],
  niche: string
): Promise<ScoutResult[]> {
  const results: ScoutResult[] = [];

  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/top.json?limit=25&t=month`;
      const { data } = await axios.get(url, {
        headers: { "User-Agent": "AffArmy/1.0 (affiliate scout)" },
        timeout: 8000,
      });

      const posts = data?.data?.children ?? [];
      for (const post of posts) {
        const d = post.data;
        if (!d.author || d.author === "[deleted]") continue;

        // Check if the author might have a blog/contact
        const authorProfile = await fetchRedditProfile(d.author);
        if (authorProfile) {
          results.push({ ...authorProfile, niche, platform: "reddit" });
        }
      }
    } catch (err) {
      logger.warn(`[scout/reddit] failed for r/${sub}: ${(err as Error).message}`);
    }
  }

  return deduplicate(results);
}

async function fetchRedditProfile(username: string): Promise<ScoutResult | null> {
  try {
    const { data } = await axios.get(
      `https://www.reddit.com/user/${username}/about.json`,
      {
        headers: { "User-Agent": "AffArmy/1.0" },
        timeout: 5000,
      }
    );
    const d = data?.data;
    if (!d) return null;

    const website = d.subreddit?.public_description ?? "";
    const emailMatch = website.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    if (!emailMatch) return null;

    return {
      name: d.name,
      email: emailMatch[0].toLowerCase(),
      handle: username,
      platform: "reddit",
      followerCount: d.subreddit?.subscribers ?? 0,
      website: d.subreddit?.display_name_prefixed
        ? `https://reddit.com/${d.subreddit.display_name_prefixed}`
        : undefined,
      score: Math.min(100, Math.floor((d.link_karma + d.comment_karma) / 1000)),
    };
  } catch {
    return null;
  }
}

// ── ProductHunt Scouting ──────────────────────────────────────

export async function scoutProductHunt(niche: string): Promise<ScoutResult[]> {
  const results: ScoutResult[] = [];
  try {
    const query = `
      query {
        posts(first: 20, order: VOTES, topic: "${niche}") {
          edges { node { name tagline url user { name username profileImage } } }
        }
      }`;

    const { data } = await axios.post(
      "https://api.producthunt.com/v2/api/graphql",
      { query },
      {
        headers: {
          Authorization: `Bearer ${process.env.PRODUCT_HUNT_TOKEN ?? ""}`,
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const posts = data?.data?.posts?.edges ?? [];
    for (const { node } of posts) {
      if (!node?.user?.username) continue;
      const website = node.url ?? "";
      const emailMatch = website.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
      results.push({
        name: node.user.name,
        email: emailMatch ? emailMatch[0] : `${node.user.username}@producthunt.placeholder`,
        handle: node.user.username,
        platform: "producthunt",
        niche,
        website: node.url,
        score: 60,
      });
    }
  } catch (err) {
    logger.warn(`[scout/producthunt] error: ${(err as Error).message}`);
  }
  return deduplicate(results);
}

// ── Manual CSV Import ─────────────────────────────────────────

export function parseManualCsv(csvText: string, niche: string): ScoutResult[] {
  // CSV format: name,email,handle,platform,followerCount,website
  const lines = csvText.trim().split("\n").slice(1); // skip header
  const results: ScoutResult[] = [];

  for (const line of lines) {
    const [name, email, handle, platform, followerCount, website] = line
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""));

    if (!email || !email.includes("@")) continue;

    results.push({
      name: name || undefined,
      email: email.toLowerCase(),
      handle: handle || undefined,
      platform: platform || "manual",
      followerCount: followerCount ? parseInt(followerCount) : undefined,
      website: website || undefined,
      niche,
      score: 50,
    });
  }

  return results;
}

// ── Blog/Newsletter Scout ─────────────────────────────────────

export async function scoutBloggersByNiche(
  searchTerms: string[]
): Promise<ScoutResult[]> {
  const results: ScoutResult[] = [];

  for (const term of searchTerms) {
    try {
      // Use a public search-adjacent approach (robots.txt friendly)
      const url = `https://blogsearch.google.com/blogsearch/feeds/search?q=${encodeURIComponent(term)}&num=10&output=json`;
      const { data } = await axios.get(url, { timeout: 5000 }).catch(() => ({ data: null }));

      if (data?.feed?.entry) {
        for (const entry of data.feed.entry) {
          const link = entry.link?.[0]?.href;
          if (!link) continue;
          const email = await extractContactEmail(link);
          if (email) {
            results.push({
              email,
              platform: "blog",
              niche: term,
              website: link,
              score: 40,
            });
          }
        }
      }
    } catch {
      // silently skip failed searches
    }
  }

  return deduplicate(results);
}

async function extractContactEmail(url: string): Promise<string | null> {
  try {
    const { data } = await axios.get(url, {
      timeout: 6000,
      maxRedirects: 3,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AffArmy/1.0)" },
    });
    const $ = cheerio.load(data as string);
    const text = $("body").text();
    const match = text.match(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
  } catch {
    return null;
  }
}

function deduplicate(results: ScoutResult[]): ScoutResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.email)) return false;
    seen.add(r.email);
    return true;
  });
}
