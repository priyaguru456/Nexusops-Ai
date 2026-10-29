import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const result = await prisma.$queryRaw<Array<{ current_database: string }>>`SELECT current_database()`;
    const dbName = result[0]?.current_database;
    console.log(`DB connected: ${dbName}`);
    process.exit(0);
  } catch (err: any) {
    console.error("Database connection failed:", err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
