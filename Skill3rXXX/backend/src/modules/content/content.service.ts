/**
 * Content Service — manages scheduled content posts and AI-assisted generation.
 * Posts are stored in the DB and dispatched by the content job queue.
 */
import OpenAI from "openai";
import { PrismaClient, Prisma, ContentStatus, ContentPlatform } from "@prisma/client";
import { config } from "../../config";
import { NotFoundError, AppError } from "../../middleware/errorHandler";
import { CreateContentDto, GenerateContentDto } from "./content.schema";

const prisma = new PrismaClient();

// Only initialize OpenAI if key is configured
let openai: OpenAI | null = null;
if (config.openai.apiKey) {
  openai = new OpenAI({ apiKey: config.openai.apiKey });
}

// ── CRUD ──────────────────────────────────────────────────────

export async function createPost(userId: string, dto: CreateContentDto) {
  const slug = dto.platform === ContentPlatform.BLOG
    ? `${dto.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`
    : undefined;

  return prisma.contentPost.create({
    data: {
      userId,
      title: dto.title,
      body: dto.body,
      excerpt: dto.excerpt,
      platform: dto.platform,
      tags: dto.tags,
      metadata: (dto.metadata ?? {}) as Prisma.InputJsonValue,
      status: dto.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      slug,
    },
  });
}

export async function listPosts(userId: string, isAdmin: boolean) {
  return prisma.contentPost.findMany({
    where: isAdmin ? {} : { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function getPost(id: string) {
  const post = await prisma.contentPost.findUnique({ where: { id } });
  if (!post) throw new NotFoundError("Content post");
  return post;
}

export async function deletePost(id: string, userId: string, isAdmin: boolean) {
  const post = await getPost(id);
  if (!isAdmin && post.userId !== userId) throw new AppError("Forbidden", 403);
  return prisma.contentPost.delete({ where: { id } });
}

// ── AI Generation ─────────────────────────────────────────────

const PLATFORM_PROMPTS: Record<ContentPlatform, string> = {
  BLOG: "Write a detailed, SEO-optimized blog article with H2 subheadings and a conclusion with a CTA.",
  TWITTER: "Write a concise, engaging tweet thread (5–7 tweets numbered 1/ 2/ etc.) under 280 chars each.",
  FACEBOOK: "Write a conversational Facebook post that encourages engagement. Use line breaks for readability.",
  INSTAGRAM: "Write an Instagram caption with emojis, a hook in the first line, and 20-30 relevant hashtags.",
  PINTEREST: "Write a Pinterest pin description (150–300 words) that is keyword-rich and visually descriptive.",
  EMAIL: "Write a compelling marketing email with subject line, preview text, body, and CTA button text.",
  LINKEDIN: "Write a professional LinkedIn article that demonstrates expertise and ends with a discussion question.",
};

/**
 * Uses OpenAI to generate platform-optimized content.
 * Stores the result as a DRAFT post ready for review/scheduling.
 */
export async function generateContent(userId: string, dto: GenerateContentDto) {
  if (!openai) throw new AppError("AI content generation is not configured", 503);

  const keywordStr = dto.keywords.length > 0 ? `Keywords to include: ${dto.keywords.join(", ")}.` : "";
  const ctaStr = dto.includeAffiliateCta && dto.productSlug
    ? `Include a natural call-to-action linking to: [product page for ${dto.productSlug}].`
    : "";

  const systemPrompt = `You are an expert content marketer specializing in passive income education and digital products.
${PLATFORM_PROMPTS[dto.platform]}
Tone: ${dto.tone}.
${keywordStr}
${ctaStr}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Create content about: "${dto.topic}"`,
      },
    ],
    max_tokens: 2000,
    temperature: 0.7,
  });

  const body = completion.choices[0]?.message?.content ?? "";
  const title = `${dto.topic} — ${dto.platform}`;

  return prisma.contentPost.create({
    data: {
      userId,
      title,
      body,
      platform: dto.platform,
      tags: dto.keywords,
      status: ContentStatus.DRAFT,
      aiGenerated: true,
    },
  });
}

// ── Scheduling ────────────────────────────────────────────────

/**
 * Fetches posts due to be published (scheduled and past their scheduledAt time).
 * Called by the Bull job every minute.
 */
export async function getDuePosts() {
  return prisma.contentPost.findMany({
    where: {
      status: ContentStatus.SCHEDULED,
      scheduledAt: { lte: new Date() },
    },
  });
}

export async function markPublished(id: string, metadata?: object) {
  return prisma.contentPost.update({
    where: { id },
    data: {
      status: ContentStatus.PUBLISHED,
      publishedAt: new Date(),
      ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function markFailed(id: string, errorMessage: string) {
  return prisma.contentPost.update({
    where: { id },
    data: { status: ContentStatus.FAILED, errorMessage },
  });
}

// ── Stats ─────────────────────────────────────────────────────

export async function getContentStats() {
  const [total, published, scheduled, failed] = await Promise.all([
    prisma.contentPost.count(),
    prisma.contentPost.count({ where: { status: ContentStatus.PUBLISHED } }),
    prisma.contentPost.count({ where: { status: ContentStatus.SCHEDULED } }),
    prisma.contentPost.count({ where: { status: ContentStatus.FAILED } }),
  ]);

  const byPlatform = await prisma.contentPost.groupBy({
    by: ["platform"],
    where: { status: ContentStatus.PUBLISHED },
    _count: { id: true },
  });

  return {
    total,
    published,
    scheduled,
    failed,
    byPlatform: Object.fromEntries(byPlatform.map((r) => [r.platform, r._count.id])),
  };
}
