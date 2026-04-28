import { prisma } from "./client";

async function seed() {
  console.log("Seeding database...");

  // Create a demo affiliate
  const affiliate = await prisma.affiliate.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      name: "Demo Affiliate",
      email: "demo@example.com",
      code: "DEMO01",
      commissionRate: 0.3,
      totalClicks: 142,
      totalConversions: 12,
      totalEarnings: 36000,
      pendingPayout: 12000,
    },
  });

  console.log("Created affiliate:", affiliate.code);

  // Create a few demo snapshots
  const days = 7;
  for (let i = days; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = d.toISOString().split("T")[0];
    await prisma.dailySnapshot.upsert({
      where: { date },
      update: {},
      create: {
        date,
        clicks: Math.floor(Math.random() * 50) + 10,
        conversions: Math.floor(Math.random() * 5),
        revenue: Math.floor(Math.random() * 50000) + 5000,
        commission: Math.floor(Math.random() * 15000) + 1500,
        newAffiliates: Math.floor(Math.random() * 2),
        newProspects: Math.floor(Math.random() * 10) + 2,
      },
    });
  }

  console.log("Seeded snapshots for last 7 days");
  console.log("Done.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
