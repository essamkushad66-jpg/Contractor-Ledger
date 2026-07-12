import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, projectsTable, transactionsTable } from "@workspace/db";
import {
  CreateProjectTransactionBody,
  CreateProjectTransactionParams,
  CreateProjectTransactionResponse,
  DeleteTransactionParams,
  ListProjectTransactionsParams,
  ListProjectTransactionsResponse,
  UpdateTransactionBody,
  UpdateTransactionParams,
  UpdateTransactionResponse,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

type Env = {
  Variables: {
    userId: string
  }
}

const router = new Hono<Env>();

router.use("*", requireAuth);

router.get("/projects/:id/transactions", async (c) => {
  const userId = c.get("userId");
  const params = ListProjectTransactionsParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.id),
        eq(projectsTable.userId, userId),
      ),
    );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.projectId, params.data.id))
    .orderBy(transactionsTable.date, transactionsTable.createdAt);

  return c.json(
    ListProjectTransactionsResponse.parse(
      transactions.map((t) => ({ ...t, amount: Number(t.amount) })),
    ),
  );
});

router.post("/projects/:id/transactions", async (c) => {
  const userId = c.get("userId");
  const params = CreateProjectTransactionParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProjectTransactionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.id, params.data.id),
        eq(projectsTable.userId, userId),
      ),
    );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const dateStr = parsed.data.date.toISOString().slice(0, 10);
  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      ...parsed.data,
      date: dateStr,
      amount: String(parsed.data.amount),
      projectId: params.data.id,
    })
    .returning();

  if (!transaction) {
    return c.json({ error: "Failed to create transaction" }, 400);
  }

  return c.json(
    CreateProjectTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
    }),
    201
  );
});

async function findOwnedTransaction(transactionId: number, userId: string) {
  const [row] = await db
    .select({ transaction: transactionsTable })
    .from(transactionsTable)
    .innerJoin(
      projectsTable,
      eq(transactionsTable.projectId, projectsTable.id),
    )
    .where(
      and(
        eq(transactionsTable.id, transactionId),
        eq(projectsTable.userId, userId),
      ),
    );
  return row?.transaction;
}

router.patch("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const params = UpdateTransactionParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateTransactionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const owned = await findOwnedTransaction(params.data.id, userId);
  if (!owned) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  const { date, amount, ...rest } = parsed.data;
  const [transaction] = await db
    .update(transactionsTable)
    .set({
      ...rest,
      ...(date ? { date: date.toISOString().slice(0, 10) } : {}),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
    })
    .where(eq(transactionsTable.id, params.data.id))
    .returning();

  if (!transaction) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  return c.json(
    UpdateTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
    }),
  );
});

router.delete("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const params = DeleteTransactionParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const owned = await findOwnedTransaction(params.data.id, userId);
  if (!owned) {
    return c.json({ error: "Transaction not found" }, 404);
  }

  await db
    .delete(transactionsTable)
    .where(eq(transactionsTable.id, params.data.id));

  return new Response(null, { status: 204 });
});

export default router;
