import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db, activityLogTable, projectsTable, projectMembersTable } from "@workspace/db";
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

router.get("/projects/:id/activity", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);

  const limitStr = c.req.query("limit") || "20";
  const offsetStr = c.req.query("offset") || "0";
  const limit = parseInt(limitStr, 10);
  const offset = parseInt(offsetStr, 10);

  const activities = await db
    .select()
    .from(activityLogTable)
    .where(eq(activityLogTable.projectId, projectId))
    .orderBy(desc(activityLogTable.createdAt))
    .limit(isNaN(limit) ? 20 : limit)
    .offset(isNaN(offset) ? 0 : offset);

  return c.json(activities);
});

export default router;
