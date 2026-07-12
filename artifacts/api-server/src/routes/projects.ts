import { Hono } from "hono";
import { and, eq, isNull } from "drizzle-orm";
import { db, projectsTable, transactionsTable } from "@workspace/db";
import {
  CreateProjectBody,
  CreateProjectResponse,
  DeleteProjectParams,
  GetProjectParams,
  GetProjectResponse,
  ListProjectsResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
} from "@workspace/api-zod";
import { attachTotals, attachTotalsSingle } from "../lib/projectTotals";
import { requireAuth } from "../middlewares/requireAuth";

type Env = {
  Variables: {
    userId: string
  }
}

const router = new Hono<Env>();

router.use("*", requireAuth);

// One-time claim: any project created before auth was added (userId is
// still null) is adopted by the first signed-in user who lists projects.
async function claimOrphanProjects(userId: string): Promise<void> {
  await db
    .update(projectsTable)
    .set({ userId })
    .where(isNull(projectsTable.userId));
}

router.get("/projects", async (c) => {
  const userId = c.get("userId");
  await claimOrphanProjects(userId);
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(projectsTable.createdAt);
  const withTotals = await attachTotals(projects);
  return c.json(ListProjectsResponse.parse(withTotals));
});

router.post("/projects", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [project] = await db
    .insert(projectsTable)
    .values({ ...parsed.data, userId })
    .returning();

  if (!project) {
    return c.json({ error: "Failed to create project" }, 400);
  }

  const withTotals = await attachTotalsSingle(project);
  return c.json(CreateProjectResponse.parse(withTotals), 201);
});

router.get("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = GetProjectParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)),
    );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const withTotals = await attachTotalsSingle(project);
  return c.json(GetProjectResponse.parse(withTotals));
});

router.patch("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = UpdateProjectParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const [project] = await db
    .update(projectsTable)
    .set(parsed.data)
    .where(
      and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)),
    )
    .returning();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const withTotals = await attachTotalsSingle(project);
  return c.json(UpdateProjectResponse.parse(withTotals));
});

router.delete("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = DeleteProjectParams.safeParse(c.req.param());
  if (!params.success) {
    return c.json({ error: params.error.message }, 400);
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(
      and(eq(projectsTable.id, params.data.id), eq(projectsTable.userId, userId)),
    );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  await db
    .delete(transactionsTable)
    .where(eq(transactionsTable.projectId, params.data.id));

  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));

  return new Response(null, { status: 204 });
});

export default router;
