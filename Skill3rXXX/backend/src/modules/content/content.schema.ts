import { z } from "zod";
import { ContentPlatform, ContentStatus } from "@prisma/client";

export const CreateContentSchema = z.object({
  title: z.string().min(1).max(300),
  body: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  platform: z.nativeEnum(ContentPlatform),
  scheduledAt: z.string().datetime().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export const GenerateContentSchema = z.object({
  topic: z.string().min(3).max(200),
  platform: z.nativeEnum(ContentPlatform),
  tone: z.enum(["professional", "casual", "educational", "promotional"]).default("educational"),
  keywords: z.array(z.string()).default([]),
  includeAffiliateCta: z.boolean().default(false),
  productSlug: z.string().optional(),
});

export type CreateContentDto = z.infer<typeof CreateContentSchema>;
export type GenerateContentDto = z.infer<typeof GenerateContentSchema>;
