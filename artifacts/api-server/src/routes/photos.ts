import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { db, sitePhotosTable, projectsTable, projectMembersTable } from "@workspace/db";
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

router.get("/projects/:id/photos", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);

  const photos = await db
    .select()
    .from(sitePhotosTable)
    .where(eq(sitePhotosTable.projectId, projectId))
    .orderBy(desc(sitePhotosTable.takenAt));

  return c.json(photos);
});

router.post("/projects/:id/photos", async (c) => {
  const userId = c.get("userId");
  const projectId = parseInt(c.req.param("id"), 10);
  if (isNaN(projectId)) return c.json({ error: "Invalid project id" }, 400);

  const { project, role } = await checkProjectAccess(projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor" && role !== "site_manager") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const { photoPath, caption, takenAt } = body;

  if (!photoPath) {
    return c.json({ error: "Missing required photoPath" }, 400);
  }

  const [photo] = await db
    .insert(sitePhotosTable)
    .values({
      projectId,
      userId,
      photoPath,
      caption,
      takenAt: takenAt ? (takenAt.includes('T') ? takenAt : new Date(takenAt).toISOString()) : new Date().toISOString(),
    })
    .returning();

  await logActivity(projectId, userId, 'created', 'photo', photo.id, { caption });

  return c.json(photo, 201);
});

router.delete("/photos/:id", async (c) => {
  const userId = c.get("userId");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) return c.json({ error: "Invalid id" }, 400);

  const [photo] = await db.select().from(sitePhotosTable).where(eq(sitePhotosTable.id, id));
  if (!photo) return c.json({ error: "Photo not found" }, 404);

  const { project, role } = await checkProjectAccess(photo.projectId, userId);
  if (!project) return c.json({ error: "Project not found or access denied" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden. Only owner or editor can delete." }, 403);

  await db.delete(sitePhotosTable).where(eq(sitePhotosTable.id, id));

  await logActivity(photo.projectId, userId, 'deleted', 'photo', photo.id);

  return new Response(null, { status: 204 });
});

export default router;
