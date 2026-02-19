import { db } from "./db";
import { eq, isNull, sql } from "drizzle-orm";
import { users, financialModels, portfolioPositions, macroIndicators, marketIndices, portfolioRedFlags, cryptoProjects } from "@shared/schema";

export async function migrateOrphanedData() {
  const [adminUser] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);

  if (!adminUser) {
    const [firstUser] = await db.select().from(users).limit(1);
    if (firstUser) {
      await db.update(users).set({ isAdmin: true }).where(eq(users.id, firstUser.id));
      console.log(`[migrate] Promoted first user ${firstUser.email || firstUser.id} to admin`);
      await assignOrphanedToUser(firstUser.id);
    }
  } else {
    await assignOrphanedToUser(adminUser.id);
  }
}

async function assignOrphanedToUser(userId: string) {
  const tables = [
    { table: financialModels, name: "financial_models" },
    { table: portfolioPositions, name: "portfolio_positions" },
    { table: macroIndicators, name: "macro_indicators" },
    { table: marketIndices, name: "market_indices" },
    { table: portfolioRedFlags, name: "portfolio_red_flags" },
    { table: cryptoProjects, name: "crypto_projects" },
  ] as const;

  for (const { table, name } of tables) {
    const result = await db.update(table).set({ userId }).where(isNull(table.userId));
    console.log(`[migrate] Assigned orphaned ${name} to user ${userId}`);
  }
}
