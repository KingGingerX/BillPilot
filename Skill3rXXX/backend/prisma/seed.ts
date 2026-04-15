/**
 * Database Seed — creates initial admin user, subscription plans,
 * and sample products for first-run setup.
 * Run via: npm run seed
 */
import { PrismaClient, Role, ProductType, ProductStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin User ──────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD!;

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        firstName: "Admin",
        lastName: "PIMS",
        role: Role.ADMIN,
        isEmailVerified: true,
      },
    });
    console.log(`✅ Admin user created: ${adminEmail}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
  }

  // ── Subscription Plans ───────────────────────────────────
  const plans = [
    {
      name: "Starter",
      slug: "starter",
      description: "Perfect for beginners building their first income stream.",
      priceInCents: 1900, // $19/month
      intervalDays: 30,
      features: ["5 affiliate links", "Basic analytics", "Email support", "1 content post/day"],
    },
    {
      name: "Growth",
      slug: "growth",
      description: "Scale your income with advanced tools and automation.",
      priceInCents: 4900, // $49/month
      intervalDays: 30,
      features: [
        "Unlimited affiliate links",
        "Advanced analytics",
        "Priority support",
        "10 content posts/day",
        "AI content generation",
        "Custom affiliate commissions",
      ],
    },
    {
      name: "Empire",
      slug: "empire",
      description: "Full automation suite for serious passive income at scale.",
      priceInCents: 9900, // $99/month
      intervalDays: 30,
      features: [
        "Everything in Growth",
        "Unlimited content automation",
        "Multi-platform publishing",
        "Affiliate sub-network",
        "Revenue API access",
        "Dedicated account manager",
        "White-label option",
      ],
    },
    {
      name: "Empire Annual",
      slug: "empire-annual",
      description: "Empire plan billed annually — save 2 months.",
      priceInCents: 99000, // $990/year
      intervalDays: 365,
      features: [
        "Everything in Empire",
        "2 months free",
        "Early access to new features",
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: {},
      create: { ...plan, isActive: true },
    });
  }
  console.log(`✅ ${plans.length} subscription plans seeded`);

  // ── Sample Products ──────────────────────────────────────
  const products = [
    {
      name: "Passive Income Blueprint 2024",
      slug: "passive-income-blueprint-2024",
      description: "The definitive 150-page guide to building 7 income streams from scratch.",
      type: ProductType.PDF,
      status: ProductStatus.ACTIVE,
      priceInCents: 2700, // $27
      tags: ["passive income", "guide", "PDF"],
    },
    {
      name: "Affiliate Marketing Mastery Course",
      slug: "affiliate-marketing-mastery-course",
      description: "60+ video lessons covering every aspect of profitable affiliate marketing.",
      type: ProductType.COURSE,
      status: ProductStatus.ACTIVE,
      priceInCents: 19700, // $197
      tags: ["affiliate", "course", "video"],
    },
    {
      name: "Email Swipe File Templates",
      slug: "email-swipe-file-templates",
      description: "500 proven email templates for every stage of your sales funnel.",
      type: ProductType.TEMPLATE,
      status: ProductStatus.ACTIVE,
      priceInCents: 4700, // $47
      tags: ["email", "templates", "marketing"],
    },
    {
      name: "The Complete Bundle",
      slug: "complete-bundle",
      description: "All products bundled together at a massive discount.",
      type: ProductType.BUNDLE,
      status: ProductStatus.ACTIVE,
      priceInCents: 19700, // $197 (saves $74)
      tags: ["bundle", "value", "all-in-one"],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: { ...product },
    });
  }
  console.log(`✅ ${products.length} products seeded`);

  console.log("🎉 Database seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
