import { z } from "zod";
import { ProductType, ProductStatus } from "@prisma/client";

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9-]+$/),
  description: z.string().min(1).max(500),
  longDescription: z.string().optional(),
  type: z.nativeEnum(ProductType),
  priceInCents: z.number().int().positive(),
  tags: z.array(z.string()).default([]),
  coverImageUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  status: z.nativeEnum(ProductStatus).optional(),
  stripePriceId: z.string().optional(),
  stripeProductId: z.string().optional(),
});

export const CreateCheckoutSchema = z.object({
  productId: z.string().uuid(),
  affiliateCode: z.string().optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateProductDto = z.infer<typeof CreateProductSchema>;
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;
