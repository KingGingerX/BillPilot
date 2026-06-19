import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export async function seedDatabase() {
  let feeConfig = await prisma.feeConfig.findFirst();
  if (!feeConfig) {
    feeConfig = await prisma.feeConfig.create({ data: {} });
  }

  let gameMaster = await prisma.user.findFirst({ where: { role: "GAMEMASTER" } });
  if (!gameMaster) {
    const hashed = await bcrypt.hash("gamemaster123", 10);
    gameMaster = await prisma.user.create({
      data: {
        name: "The Game Master",
        email: "gamemaster@gameboard.com",
        password: hashed,
        role: "GAMEMASTER",
        reputation: 999,
        level: 99,
        xp: 99999,
      },
    });
  }

  const sampleUsers = [
    { name: "Aria Storm", email: "aria@example.com" },
    { name: "Kai Blaze", email: "kai@example.com" },
    { name: "Nova Kane", email: "nova@example.com" },
  ];

  const createdUsers = [];
  for (const u of sampleUsers) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      const hashed = await bcrypt.hash("password123", 10);
      user = await prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          password: hashed,
          reputation: 100 + Math.floor(Math.random() * 50),
          level: 1 + Math.floor(Math.random() * 5),
          xp: Math.floor(Math.random() * 500),
        },
      });
    }
    createdUsers.push(user);
  }

  const sampleQuests = [
    {
      title: "Beat my Elden Ring no-hit run",
      description:
        "I have completed Elden Ring without taking a single hit. First player to upload proof of doing the same wins the bounty.",
      type: "CHALLENGE",
      category: "Gaming",
      price: 10000,
      rules: "Must be a new character, no glitches, full run video required.",
      creator: createdUsers[0],
    },
    {
      title: "Design a cyberpunk logo",
      description:
        "I need a logo for my synthwave music project. Looking for something neon, retro, and bold.",
      type: "SERVICE",
      category: "Design",
      price: 7500,
      rules: "Deliver PNG and SVG. 3 revision rounds included.",
      creator: createdUsers[1],
    },
    {
      title: "Will Bitcoin hit $100k by New Year?",
      description:
        "Head-to-head prediction: Bitcoin closes above $100,000 USD on Coinbase by Dec 31.",
      type: "BET",
      category: "Crypto",
      price: 5000,
      rules: "Settlement via Coinbase daily close. Winner takes the pot minus house rake.",
      creator: createdUsers[2],
    },
    {
      title: "30-day fitness accountability",
      description:
        "Check in daily with a workout photo for 30 days. Complete the streak to earn the bounty back.",
      type: "CHALLENGE",
      category: "Fitness",
      price: 3000,
      rules: "Daily photo timestamp required. Miss a day and forfeit.",
      creator: createdUsers[0],
    },
    {
      title: "Vintage sneaker resale",
      description: "Deadstock Jordan 1 High Chicago Reimagined, size 11.",
      type: "ITEM",
      category: "Fashion",
      price: 25000,
      rules: "Ships insured within 2 business days.",
      creator: createdUsers[1],
    },
    {
      title: "Guided night hike + astrophotography",
      description:
        "Join me for a 3-hour guided night hike under dark skies. I'll teach you Milky Way photography.",
      type: "EXPERIENCE",
      category: "Outdoors",
      price: 6000,
      rules: "Bring your own camera and tripod. Weather backup date included.",
      creator: createdUsers[2],
    },
  ];

  for (const q of sampleQuests) {
    const existing = await prisma.quest.findFirst({
      where: { title: q.title, creatorId: q.creator.id },
    });
    if (!existing) {
      const fee = Math.round(q.price * (feeConfig.rakePercent / 100));
      await prisma.quest.create({
        data: {
          title: q.title,
          description: q.description,
          type: q.type as any,
          category: q.category,
          price: q.price,
          feeAmount: fee,
          rules: q.rules,
          creatorId: q.creator.id,
          maxSlots: q.type === "BET" ? 2 : 5,
          promoted: Math.random() > 0.7 ? "FEATURED" : "NONE",
        },
      });
      await prisma.user.update({
        where: { id: q.creator.id },
        data: { questsCreated: { increment: 1 }, xp: { increment: 10 } },
      });
    }
  }

  return {
    success: true,
    gameMaster: {
      email: gameMaster.email,
      password: "gamemaster123",
    },
    message: "Seeded sample users and quests.",
  };
}
