import { db } from "./db";
import { eq, isNull } from "drizzle-orm";
import { users, financialModels, portfolioPositions, macroIndicators, marketIndices, portfolioRedFlags, cryptoProjects } from "@shared/schema";

export async function migrateOrphanedData() {
  try {
    let adminUser: any;
    try {
      [adminUser] = await db.select().from(users).where(eq(users.isAdmin, true)).limit(1);
    } catch {
      console.log("[migrate] is_admin column may not exist yet, skipping admin check");
      return;
    }

    if (!adminUser) {
      const [firstUser] = await db.select().from(users).limit(1);
      if (firstUser) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, firstUser.id));
        console.log(`[migrate] Promoted first user ${firstUser.email || firstUser.id} to admin`);
        await assignOrphanedToUser(firstUser.id);
      } else {
        console.log("[migrate] No users found, skipping migration");
      }
    } else {
      await assignOrphanedToUser(adminUser.id);
    }
  } catch (err) {
    console.error("[migrate] Error during data migration:", err);
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
    try {
      await db.update(table).set({ userId }).where(isNull(table.userId));
      console.log(`[migrate] Assigned orphaned ${name} to user ${userId}`);
    } catch (err) {
      console.error(`[migrate] Error assigning ${name}:`, err);
    }
  }
}
