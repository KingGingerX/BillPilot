import { prisma } from "@/lib/prisma";

async function main() {
  const users = await prisma.user.count();
  const quests = await prisma.quest.count();
  const transactions = await prisma.transaction.count();
  const gameMasters = await prisma.user.count({ where: { role: "GAMEMASTER" } });

  console.log({ users, quests, transactions, gameMasters });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
