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
import { logActivity } from "../lib/activityLogger";

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
        deductionType: t.deductionType || undefined,
        deductionValue: t.deductionValue !== null ? Number(t.deductionValue) : undefined,
        deductionReason: t.deductionReason || undefined,
        transportCost: t.transportCost !== null ? Number(t.transportCost) : undefined,
        laborCost: t.laborCost !== null ? Number(t.laborCost) : undefined,
        exchangeRate: t.exchangeRate !== null ? Number(t.exchangeRate) : undefined,
        latitude: t.latitude !== null ? Number(t.latitude) : undefined,
        longitude: t.longitude !== null ? Number(t.longitude) : undefined,
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
      deductionType: parsed.data.deductionType || undefined,
      deductionValue: parsed.data.deductionValue !== undefined ? String(parsed.data.deductionValue) : null,
      transportCost: parsed.data.transportCost !== undefined ? String(parsed.data.transportCost) : null,
      laborCost: parsed.data.laborCost !== undefined ? String(parsed.data.laborCost) : null,
      exchangeRate: parsed.data.exchangeRate !== undefined && parsed.data.exchangeRate !== null ? String(parsed.data.exchangeRate) : null,
      latitude: parsed.data.latitude !== undefined ? String(parsed.data.latitude) : null,
      longitude: parsed.data.longitude !== undefined ? String(parsed.data.longitude) : null,
      projectId: params.data.id,
    })
    .returning();

  if (!transaction) return c.json({ error: "Failed to create transaction" }, 400);

  await logActivity(params.data.id, userId, 'created', 'transaction', transaction.id, { amount: transaction.amount, type: transaction.type, description: transaction.description });

  return c.json(
    CreateProjectTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
      deductionType: transaction.deductionType || undefined,
      deductionValue: transaction.deductionValue !== null ? Number(transaction.deductionValue) : undefined,
      deductionReason: transaction.deductionReason || undefined,
      transportCost: transaction.transportCost !== null ? Number(transaction.transportCost) : undefined,
      laborCost: transaction.laborCost !== null ? Number(transaction.laborCost) : undefined,
      exchangeRate: transaction.exchangeRate !== null ? Number(transaction.exchangeRate) : undefined,
      latitude: transaction.latitude !== null ? Number(transaction.latitude) : undefined,
      longitude: transaction.longitude !== null ? Number(transaction.longitude) : undefined,
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
    deductionType: tx.deductionType || undefined,
    deductionValue: tx.deductionValue !== undefined ? String(tx.deductionValue) : null,
    deductionReason: tx.deductionReason || undefined,
    transportCost: tx.transportCost !== undefined ? String(tx.transportCost) : null,
    laborCost: tx.laborCost !== undefined ? String(tx.laborCost) : null,
    exchangeRate: tx.exchangeRate !== undefined && tx.exchangeRate !== null ? String(tx.exchangeRate) : null,
    latitude: tx.latitude !== undefined ? String(tx.latitude) : null,
    longitude: tx.longitude !== undefined ? String(tx.longitude) : null,
    projectId: params.data.id,
  }));

  const inserted = await db
    .insert(transactionsTable)
    .values(valuesToInsert)
    .returning();

  for (const t of inserted) {
    await logActivity(params.data.id, userId, 'created', 'transaction', t.id, { amount: t.amount, type: t.type, description: t.description });
  }

  return c.json(
    inserted.map(t => CreateProjectTransactionResponse.parse({
      ...t,
      amount: Number(t.amount),
      deductionType: t.deductionType || undefined,
      deductionValue: t.deductionValue !== null ? Number(t.deductionValue) : undefined,
      deductionReason: t.deductionReason || undefined,
      transportCost: t.transportCost !== null ? Number(t.transportCost) : undefined,
      laborCost: t.laborCost !== null ? Number(t.laborCost) : undefined,
      exchangeRate: t.exchangeRate !== null ? Number(t.exchangeRate) : undefined,
      latitude: t.latitude !== null ? Number(t.latitude) : undefined,
      longitude: t.longitude !== null ? Number(t.longitude) : undefined,
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

  const { date, amount, deductionValue, transportCost, laborCost, exchangeRate, latitude, longitude, ...rest } = parsed.data;
  const [transaction] = await db
    .update(transactionsTable)
    .set({
      ...rest,
      ...(date ? { date: date.toISOString().slice(0, 10) } : {}),
      ...(amount !== undefined ? { amount: String(amount) } : {}),
      ...(deductionValue !== undefined ? { deductionValue: deductionValue === null ? null : String(deductionValue) } : {}),
      ...(transportCost !== undefined ? { transportCost: transportCost === null ? null : String(transportCost) } : {}),
      ...(laborCost !== undefined ? { laborCost: laborCost === null ? null : String(laborCost) } : {}),
      ...(exchangeRate !== undefined ? { exchangeRate: exchangeRate === null ? null : String(exchangeRate) } : {}),
      ...(latitude !== undefined ? { latitude: latitude === null ? null : String(latitude) } : {}),
      ...(longitude !== undefined ? { longitude: longitude === null ? null : String(longitude) } : {}),
    })
    .where(eq(transactionsTable.id, params.data.id))
    .returning();

  if (!transaction) return c.json({ error: "Transaction not found" }, 404);

  await logActivity(transaction.projectId, userId, 'updated', 'transaction', transaction.id, { amount: transaction.amount, type: transaction.type, description: transaction.description });

  return c.json(
    UpdateTransactionResponse.parse({
      ...transaction,
      amount: Number(transaction.amount),
      deductionType: transaction.deductionType || undefined,
      deductionValue: transaction.deductionValue !== null ? Number(transaction.deductionValue) : undefined,
      deductionReason: transaction.deductionReason || undefined,
      transportCost: transaction.transportCost !== null ? Number(transaction.transportCost) : undefined,
      laborCost: transaction.laborCost !== null ? Number(transaction.laborCost) : undefined,
      exchangeRate: transaction.exchangeRate !== null ? Number(transaction.exchangeRate) : undefined,
      latitude: transaction.latitude !== null ? Number(transaction.latitude) : undefined,
      longitude: transaction.longitude !== null ? Number(transaction.longitude) : undefined,
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

  await logActivity(owned.projectId, userId, 'deleted', 'transaction', owned.id, { amount: owned.amount, type: owned.type, description: owned.description });

  return new Response(null, { status: 204 });
});

export default router;
