import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const dbPath = path.resolve(process.cwd(), "dev.db");
const adapter = new PrismaLibSql({ url: `file://${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Create default user
  const defaultUser = await prisma.user.upsert({
    where: { email: "user@example.com" },
    update: {},
    create: {
      name: "Default User",
      email: "user@example.com",
    },
  });

  console.log(`✅ Created default user: ${defaultUser.email}`);

  // Create sample accounts (optional - remove if not needed)
  const accounts = await Promise.all([
    prisma.portfolioAccount.upsert({
      where: { id: "sample-broker" },
      update: {},
      create: {
        id: "sample-broker",
        name: "Interactive Brokers",
        type: "Broker",
        currency: "USD",
        userId: defaultUser.id,
      },
    }),
    prisma.portfolioAccount.upsert({
      where: { id: "sample-crypto" },
      update: {},
      create: {
        id: "sample-crypto",
        name: "Coinbase",
        type: "Crypto Exchange",
        currency: "USD",
        userId: defaultUser.id,
      },
    }),
    prisma.portfolioAccount.upsert({
      where: { id: "sample-bank" },
      update: {},
      create: {
        id: "sample-bank",
        name: "Main Bank",
        type: "Bank",
        currency: "EUR",
        userId: defaultUser.id,
      },
    }),
  ]);

  console.log(`✅ Created ${accounts.length} sample accounts`);

  console.log("\n🎉 Seeding completed!");
  console.log("\nDefault login:");
  console.log("  Email: user@example.com");
  console.log("\nYou can now start the app with: npm run dev");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
