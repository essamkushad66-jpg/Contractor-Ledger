import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, changeOrdersTable, projectsTable, projectMembersTable } from "@workspace/db";
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

router.get("/projects/:id/change-orders", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);

  const changeOrders = await db
    .select()
    .from(changeOrdersTable)
    .where(eq(changeOrdersTable.projectId, projectId));

  const result = changeOrders.map(co => ({
    ...co,
    amountChange: co.amountChange ? Number(co.amountChange) : 0
  }));

  return c.json(result);
});

router.post("/projects/:id/change-orders", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const { title, description, amountChange } = body;

  if (!title || amountChange === undefined) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const [changeOrder] = await db
    .insert(changeOrdersTable)
    .values({
      projectId,
      userId,
      title,
      description,
      amountChange: String(amountChange),
      status: "pending",
    })
    .returning();

  await logActivity(projectId, userId, 'created', 'change_order', changeOrder.id, { title, amountChange });

  return c.json({
    ...changeOrder,
    amountChange: changeOrder.amountChange ? Number(changeOrder.amountChange) : 0
  }, 201);
});

router.patch("/change-orders/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [changeOrder] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, id));
  if (!changeOrder) return c.json({ error: "Change order not found" }, 404);

  const { project, role } = await checkProjectAccess(changeOrder.projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner") return c.json({ error: "Forbidden. Only owner can update status." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const { status } = body;

  if (!status) return c.json({ error: "Missing status" }, 400);

  const [updated] = await db
    .update(changeOrdersTable)
    .set({ status })
    .where(eq(changeOrdersTable.id, id))
    .returning();

  await logActivity(updated.projectId, userId, 'updated', 'change_order', updated.id, { status });

  return c.json({
    ...updated,
    amountChange: updated.amountChange ? Number(updated.amountChange) : 0
  });
});

router.delete("/change-orders/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [changeOrder] = await db.select().from(changeOrdersTable).where(eq(changeOrdersTable.id, id));
  if (!changeOrder) return c.json({ error: "Change order not found" }, 404);

  const { project, role } = await checkProjectAccess(changeOrder.projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner") return c.json({ error: "Forbidden. Only owner can delete." }, 403);

  await db.delete(changeOrdersTable).where(eq(changeOrdersTable.id, id));

  await logActivity(changeOrder.projectId, userId, 'deleted', 'change_order', changeOrder.id);

  return new Response(null, { status: 204 });
});

export default router;
