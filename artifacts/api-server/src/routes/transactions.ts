import { Hono } from "hono";
import { z } from "zod";
import { and, eq, or, inArray } from "drizzle-orm";
import { db, projectsTable, transactionsTable, projectMembersTable } from "@workspace/db";
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

async function checkProjectAccess(projectId: number, userId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return { project: null, role: null };
  if (project.userId === userId) return { project, role: "owner" };
  
  const [member] = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)));
    
  if (member) return { project, role: member.role };
  return { project: null, role: null };
}

router.get("/projects/:id/transactions", async (c) => {
  const userId = c.get("userId");
  const params = ListProjectTransactionsParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project || !role) return c.json({ error: "Project not found" }, 404);

  const transactions = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.projectId, params.data.id))
    .orderBy(transactionsTable.date, transactionsTable.createdAt);

  return c.json(
    ListProjectTransactionsResponse.parse(
      transactions.map((t) => ({ 
        ...t, 
        amount: Number(t.amount),
        deductionPercentage: t.deductionPercentage !== null ? Number(t.deductionPercentage) : undefined,
        deductionReason: t.deductionReason || undefined,
      })),
    ),
  );
});

router.post("/projects/:id/transactions", async (c) => {
  const userId = c.get("userId");
  const params = CreateProjectTransactionParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProjectTransactionBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project || !role) return c.json({ error: "Project not found" }, 404);
  if (role === "viewer") return c.json({ error: "Forbidden. Viewers cannot add transactions." }, 403);

  const dateStr = parsed.data.date.toISOString().slice(0, 10);
  const [transaction] = await db
    .insert(transactionsTable)
    .values({
      ...parsed.data,
      date: dateStr,
      amount: String(parsed.data.amount),
      deductionPercentage: parsed.data.deductionPercentage !== undefined ? String(parsed.data.deductionPercentage) : null,
      projectId: params.data.id,
    })
    .returning();

  if (!transaction) return c.json({ error: "Failed to create transaction" }, 400);

  return c.json(
    CreateProjectTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
      deductionPercentage: transaction.deductionPercentage !== null ? Number(transaction.deductionPercentage) : undefined,
      deductionReason: transaction.deductionReason || undefined,
    }),
    201
  );
});

router.post("/projects/:id/transactions/bulk", async (c) => {
  const userId = c.get("userId");
  const params = CreateProjectTransactionParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const body = await c.req.json().catch(() => ([]));
  const parsed = z.array(CreateProjectTransactionBody).safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project || !role) return c.json({ error: "Project not found" }, 404);
  if (role === "viewer") return c.json({ error: "Forbidden. Viewers cannot add transactions." }, 403);

  if (parsed.data.length === 0) return c.json([], 201);

  const valuesToInsert = parsed.data.map((tx: any) => ({
    ...tx,
    date: tx.date.toISOString().slice(0, 10),
    amount: String(tx.amount),
    deductionPercentage: tx.deductionPercentage !== undefined ? String(tx.deductionPercentage) : null,
    projectId: params.data.id,
  }));

  const inserted = await db
    .insert(transactionsTable)
    .values(valuesToInsert)
    .returning();

  return c.json(
    inserted.map(t => CreateProjectTransactionResponse.parse({
      ...t,
      amount: Number(t.amount),
      deductionPercentage: t.deductionPercentage !== null ? Number(t.deductionPercentage) : undefined,
      deductionReason: t.deductionReason || undefined,
    })),
    201
  );
});

async function findTransactionWithRole(transactionId: number, userId: string) {
  const [row] = await db
    .select({ transaction: transactionsTable, projectId: transactionsTable.projectId })
    .from(transactionsTable)
    .where(eq(transactionsTable.id, transactionId));
    
  if (!row) return { transaction: null, role: null };
  
  const { project, role } = await checkProjectAccess(row.projectId, userId);
  return { transaction: row.transaction, role };
}

router.patch("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const params = UpdateTransactionParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateTransactionBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { transaction: owned, role } = await findTransactionWithRole(params.data.id, userId);
  if (!owned || !role) return c.json({ error: "Transaction not found" }, 404);
  if (role === "viewer") return c.json({ error: "Forbidden" }, 403);

  const { date, amount, deductionPercentage, ...rest } = parsed.data;
  const [transaction] = await db
    .update(transactionsTable)
    .set({
      ...rest,
      ...(date ? { date: date.toISOString().slice(0, 10) } : {}),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
      ...(deductionPercentage !== undefined ? { deductionPercentage: deductionPercentage === null ? null : String(deductionPercentage) } : {}),
    })
    .where(eq(transactionsTable.id, params.data.id))
    .returning();

  if (!transaction) return c.json({ error: "Transaction not found" }, 404);

  return c.json(
    UpdateTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
      deductionPercentage: transaction.deductionPercentage !== null ? Number(transaction.deductionPercentage) : undefined,
      deductionReason: transaction.deductionReason || undefined,
    }),
  );
});

router.delete("/transactions/:id", async (c) => {
  const userId = c.get("userId");
  const params = DeleteTransactionParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { transaction: owned, role } = await findTransactionWithRole(params.data.id, userId);
  if (!owned || !role) return c.json({ error: "Transaction not found" }, 404);
  if (role === "viewer") return c.json({ error: "Forbidden" }, 403);

  await db
    .delete(transactionsTable)
    .where(eq(transactionsTable.id, params.data.id));

  return new Response(null, { status: 204 });
});

export default router;
