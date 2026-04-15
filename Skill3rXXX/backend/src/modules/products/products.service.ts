/**
 * Products Service — manages digital products and Stripe checkout sessions.
 */
import Stripe from "stripe";
import { PrismaClient, Prisma, ProductStatus } from "@prisma/client";
import { config } from "../../config";
import { encrypt } from "../../utils/crypto";
import { NotFoundError, AppError } from "../../middleware/errorHandler";
import { CreateProductDto, UpdateProductDto } from "./products.schema";

const prisma = new PrismaClient();
const stripe = new Stripe(config.stripe.secretKey, { apiVersion: "2024-04-10" });

// ── CRUD ──────────────────────────────────────────────────────

export async function createProduct(dto: CreateProductDto) {
  // Create in Stripe first so we have IDs
  const stripeProduct = await stripe.products.create({
    name: dto.name,
    description: dto.description,
    metadata: { slug: dto.slug },
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: dto.priceInCents,
    currency: "usd",
  });

  return prisma.product.create({
    data: {
      ...dto,
      metadata: dto.metadata as Prisma.InputJsonValue ?? Prisma.JsonNull,
      stripeProductId: stripeProduct.id,
      stripePriceId: stripePrice.id,
      status: ProductStatus.DRAFT,
    },
  });
}

export async function listProducts(status?: ProductStatus) {
  return prisma.product.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({ where: { slug } });
  if (!product) throw new NotFoundError("Product");
  return product;
}

export async function updateProduct(id: string, dto: UpdateProductDto) {
  await getProduct(id); // existence check

  // Sync name/description to Stripe if product has a Stripe ID
  if (dto.name || dto.description) {
    const product = await prisma.product.findUnique({ where: { id } });
    if (product?.stripeProductId) {
      await stripe.products.update(product.stripeProductId, {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
      });
    }
  }

  return prisma.product.update({
    where: { id },
    data: {
      ...dto,
      metadata: dto.metadata !== undefined ? (dto.metadata as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function deleteProduct(id: string) {
  const product = await getProduct(id);
  // Archive in Stripe, don't delete (preserves purchase history)
  if (product.stripeProductId) {
    await stripe.products.update(product.stripeProductId, { active: false });
  }
  return prisma.product.update({
    where: { id },
    data: { status: ProductStatus.ARCHIVED },
  });
}

// ── Checkout ──────────────────────────────────────────────────

export async function createCheckoutSession(
  userId: string,
  productId: string,
  affiliateCode: string | undefined,
  successUrl: string,
  cancelUrl: string
) {
  const product = await getProduct(productId);
  if (product.status !== ProductStatus.ACTIVE) {
    throw new AppError("Product is not available for purchase", 400);
  }
  if (!product.stripePriceId) {
    throw new AppError("Product is not configured for purchase", 500);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{ price: product.stripePriceId, quantity: 1 }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: {
      userId,
      productId,
      affiliateCode: affiliateCode ?? "",
    },
    customer_creation: "always",
  });

  // Create a pending order to track before webhook fires
  await prisma.order.create({
    data: {
      userId,
      status: "PENDING",
      totalAmountInCents: product.priceInCents,
      stripeSessionId: session.id,
      affiliateCode: affiliateCode ?? null,
      items: {
        create: {
          productId: product.id,
          priceInCents: product.priceInCents,
          quantity: 1,
        },
      },
    },
  });

  return { sessionId: session.id, url: session.url };
}

/**
 * Generates a time-limited signed download URL for a purchased product.
 * In production this would generate a signed S3/CDN URL.
 * The raw URL is stored encrypted in the DB.
 */
export async function getDownloadUrl(productId: string, userId: string): Promise<string> {
  // Verify user has purchased this product
  const purchase = await prisma.orderItem.findFirst({
    where: {
      productId,
      order: { userId, status: "PAID" },
    },
  });
  if (!purchase) throw new AppError("Purchase not found", 403);

  const product = await getProduct(productId);
  if (!product.downloadUrl) throw new AppError("Download not available", 404);

  // Return an encrypted token that the frontend uses to download
  return encrypt(`${productId}:${userId}:${Date.now() + 48 * 60 * 60 * 1000}`);
}

// ── Revenue stats ─────────────────────────────────────────────

export async function getProductRevenue() {
  const result = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: "PAID" } },
    _sum: { priceInCents: true },
    _count: { id: true },
  });

  const products = await prisma.product.findMany({ where: { id: { in: result.map((r) => r.productId) } } });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  return result.map((r) => ({
    product: productMap[r.productId],
    revenueInCents: r._sum.priceInCents ?? 0,
    unitsSold: r._count.id,
  }));
}
