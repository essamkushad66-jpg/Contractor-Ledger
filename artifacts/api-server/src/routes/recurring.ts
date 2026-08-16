import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, recurringTransactionsTable, projectsTable, projectMembersTable } from "@workspace/db";
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

router.get("/projects/:id/recurring", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);

  const recurrings = await db
    .select()
    .from(recurringTransactionsTable)
    .where(eq(recurringTransactionsTable.projectId, projectId));

  return c.json(recurrings);
});

router.post("/projects/:id/recurring", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const { frequency, templateData, nextRunDate } = body;

  if (!frequency || !templateData || !nextRunDate) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const [recurring] = await db
    .insert(recurringTransactionsTable)
    .values({
      projectId,
      userId,
      frequency,
      templateData,
      nextRunDate: nextRunDate.split('T')[0],
      isActive: true,
    })
    .returning();

  await logActivity(projectId, userId, 'created', 'recurring', recurring.id, { frequency, nextRunDate });

  return c.json(recurring, 201);
});

router.patch("/recurring/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [recurring] = await db.select().from(recurringTransactionsTable).where(eq(recurringTransactionsTable.id, id));
  if (!recurring) return c.json({ error: "Recurring transaction not found" }, 404);

  const { project, role } = await checkProjectAccess(recurring.projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json().catch(() => ({}));
  
  const [updated] = await db
    .update(recurringTransactionsTable)
    .set({
      ...body,
      nextRunDate: body.nextRunDate ? body.nextRunDate.split('T')[0] : recurring.nextRunDate
    })
    .where(eq(recurringTransactionsTable.id, id))
    .returning();

  await logActivity(updated.projectId, userId, 'updated', 'recurring', updated.id, { isActive: updated.isActive, frequency: updated.frequency });

  return c.json(updated);
});

router.delete("/recurring/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [recurring] = await db.select().from(recurringTransactionsTable).where(eq(recurringTransactionsTable.id, id));
  if (!recurring) return c.json({ error: "Recurring transaction not found" }, 404);

  const { project, role } = await checkProjectAccess(recurring.projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden" }, 403);

  await db.delete(recurringTransactionsTable).where(eq(recurringTransactionsTable.id, id));

  await logActivity(recurring.projectId, userId, 'deleted', 'recurring', recurring.id);

  return new Response(null, { status: 204 });
});

export default router;
