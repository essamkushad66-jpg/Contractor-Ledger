import { Hono } from "hono";
import { eq, desc, and } from "drizzle-orm";
import { db, vendorsTable, transactionsTable, projectsTable } from "@workspace/db";
import { CreateVendorBody, UpdateVendorBody, Vendor as VendorType } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

type Env = {
  Variables: {
    userId: string
  }
}

const router = new Hono<Env>();

router.use("/vendors/*", requireAuth);

router.get("/vendors", async (c) => {
  const userId = c.get("userId");
  
  const vendors = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.userId, userId))
    .orderBy(desc(vendorsTable.createdAt));

  return c.json(vendors as VendorType[]);
});

router.post("/vendors", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateVendorBody.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [vendor] = await db
    .insert(vendorsTable)
    .values({
      ...parsed.data,
      userId,
    })
    .returning();

  if (!vendor) {
    return c.json({ error: "Failed to create vendor" }, 400);
  }

  return c.json(vendor as VendorType, 201);
});

router.get("/vendors/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [vendor] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, id));

  if (!vendor || vendor.userId !== userId) {
    return c.json({ error: "Vendor not found" }, 404);
  }

  return c.json(vendor as VendorType);
});

router.put("/vendors/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateVendorBody.safeParse(body);
  
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [existing] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, id));

  if (!existing || existing.userId !== userId) {
    return c.json({ error: "Vendor not found" }, 404);
  }

  const [vendor] = await db
    .update(vendorsTable)
    .set(parsed.data)
    .where(eq(vendorsTable.id, id))
    .returning();

  return c.json(vendor as VendorType);
});

router.delete("/vendors/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [existing] = await db
    .select()
    .from(vendorsTable)
    .where(eq(vendorsTable.id, id));

  if (!existing || existing.userId !== userId) {
    return c.json({ error: "Vendor not found" }, 404);
  }

  await db.delete(vendorsTable).where(eq(vendorsTable.id, id));

  return c.json({ message: "Deleted" });
});

router.get("/vendors/:id/transactions", async (c) => {
  const userId = c.get("userId");
  const vendorId = parseInt(c.req.param("id"), 10);
  if (isNaN(vendorId)) return c.json({ error: "Invalid id" }, 400);

  const transactions = await db
    .select({
      id: transactionsTable.id,
      projectId: transactionsTable.projectId,
      amount: transactionsTable.amount,
      date: transactionsTable.date,
      description: transactionsTable.description,
      category: transactionsTable.category,
      vendorId: transactionsTable.vendorId,
      receiptPath: transactionsTable.receiptPath,
      type: transactionsTable.type,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .innerJoin(projectsTable, eq(transactionsTable.projectId, projectsTable.id))
    .where(
      and(
        eq(transactionsTable.vendorId, vendorId),
        eq(projectsTable.userId, userId)
      )
    )
    .orderBy(desc(transactionsTable.date));

  return c.json(transactions.map(t => ({
    ...t,
    amount: t.amount ? Number(t.amount) : 0
  })));
});

export default router;
