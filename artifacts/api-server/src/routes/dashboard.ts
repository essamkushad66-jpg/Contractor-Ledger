import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { db, projectsTable, transactionsTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

type Env = {
  Variables: {
    userId: string
  }
}

const router = new Hono<Env>();

router.use("*", requireAuth);

router.get("/dashboard/summary", async (c) => {
  const userId = c.get("userId");
  
  const [{ projectCount }] = await db
    .select({ projectCount: sql<number>`COUNT(*)::int` })
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId));

  const [{ totalReceived, totalSpent }] = await db
    .select({
      totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'deposit' THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
      totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'expense' THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
    })
    .from(transactionsTable)
    .innerJoin(
      projectsTable,
      eq(transactionsTable.projectId, projectsTable.id),
    )
    .where(eq(projectsTable.userId, userId));

  const received = Number(totalReceived ?? 0);
  const spent = Number(totalSpent ?? 0);

  return c.json(
    GetDashboardSummaryResponse.parse({
      projectCount: projectCount ?? 0,
      totalReceived: received,
      totalSpent: spent,
      totalBalance: received - spent,
    })
  );
});

export default router;
