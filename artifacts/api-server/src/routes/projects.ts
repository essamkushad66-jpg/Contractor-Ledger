import { Hono } from "hono";
import { and, eq, isNull, or, inArray } from "drizzle-orm";
import { db, projectsTable, transactionsTable, projectMembersTable } from "@workspace/db";
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
  ListProjectMembersParams,
  ListProjectMembersResponse,
  InviteProjectMemberParams,
  InviteProjectMemberBody,
  InviteProjectMemberResponse,
  RemoveProjectMemberParams,
} from "@workspace/api-zod";
import { attachTotals, attachTotalsSingle } from "../lib/projectTotals";
import { requireAuth } from "../middlewares/requireAuth";
import { createClerkClient } from "@clerk/backend";
import { env } from "hono/adapter";

type Env = {
  Variables: {
    userId: string
  }
}

const router = new Hono<Env>();

router.use("*", requireAuth);

async function claimOrphanProjects(userId: string): Promise<void> {
  await db
    .update(projectsTable)
    .set({ userId })
    .where(isNull(projectsTable.userId));
}

async function claimOrphanInvites(userId: string, c: any): Promise<void> {
  const { CLERK_SECRET_KEY } = env<{ CLERK_SECRET_KEY: string }>(c);
  const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const user = await clerkClient.users.getUser(userId);
  const emails = user.emailAddresses.map((e: any) => e.emailAddress);
  
  if (emails.length > 0) {
    await db.update(projectMembersTable)
      .set({ userId })
      .where(and(isNull(projectMembersTable.userId), inArray(projectMembersTable.email, emails)));
  }
}

// Helper to check if a user has access to a project
async function checkProjectAccess(projectId: number, userId: string) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) return { project: null, role: null };
  if (project.userId === userId) return { project, role: "owner" };
  
  const [member] = await db.select().from(projectMembersTable)
    .where(and(eq(projectMembersTable.projectId, projectId), eq(projectMembersTable.userId, userId)));
    
  if (member) return { project, role: member.role };
  return { project: null, role: null };
}

router.get("/projects", async (c) => {
  const userId = c.get("userId");
  await claimOrphanProjects(userId);
  await claimOrphanInvites(userId, c);

  const memberProjectIds = db.select({ id: projectMembersTable.projectId })
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, userId));

  const projects = await db
    .select()
    .from(projectsTable)
    .where(
      or(
        eq(projectsTable.userId, userId),
        inArray(projectsTable.id, memberProjectIds)
      )
    )
    .orderBy(projectsTable.createdAt);

  const members = await db.select()
    .from(projectMembersTable)
    .where(eq(projectMembersTable.userId, userId));
  const roleMap = new Map(members.map(m => [m.projectId, m.role]));

  const withTotals = await attachTotals(projects);
  const withRoles = withTotals.map(p => ({
    ...p,
    currentUserRole: (p.userId === userId ? "owner" : (roleMap.get(p.id) || "viewer")) as "owner" | "editor" | "viewer"
  }));

  return c.json(ListProjectsResponse.parse(withRoles));
});

router.post("/projects", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = CreateProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.message }, 400);
  }

  const { budget, ...restData } = parsed.data;

  const [project] = await db
    .insert(projectsTable)
    .values({ 
      ...restData, 
      budget: budget !== undefined && budget !== null ? String(budget) : null,
      userId 
    })
    .returning();

  if (!project) {
    return c.json({ error: "Failed to create project" }, 400);
  }

  const withTotals = await attachTotalsSingle(project);
  return c.json(CreateProjectResponse.parse({ ...withTotals, currentUserRole: "owner" }), 201);
});

router.get("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = GetProjectParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const withTotals = await attachTotalsSingle(project);
  return c.json(GetProjectResponse.parse({ ...withTotals, currentUserRole: role }));
});

router.patch("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = UpdateProjectParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (role !== "owner" && role !== "editor") return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json().catch(() => ({}));
  const parsed = UpdateProjectBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const { budget, ...restData } = parsed.data;

  const [updatedProject] = await db
    .update(projectsTable)
    .set({
      ...restData,
      ...(budget !== undefined && { budget: budget !== null ? String(budget) : null })
    })
    .where(eq(projectsTable.id, params.data.id))
    .returning();

  const withTotals = await attachTotalsSingle(updatedProject!);
  return c.json(UpdateProjectResponse.parse({ ...withTotals, currentUserRole: role }));
});

router.delete("/projects/:id", async (c) => {
  const userId = c.get("userId");
  const params = DeleteProjectParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (role !== "owner") return c.json({ error: "Forbidden. Only the owner can delete a project." }, 403);

  await db.delete(transactionsTable).where(eq(transactionsTable.projectId, params.data.id));
  await db.delete(projectMembersTable).where(eq(projectMembersTable.projectId, params.data.id));
  await db.delete(projectsTable).where(eq(projectsTable.id, params.data.id));

  return new Response(null, { status: 204 });
});

// MEMBERS ENDPOINTS
router.get("/projects/:id/members", async (c) => {
  const userId = c.get("userId");
  const params = ListProjectMembersParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const members = await db.select().from(projectMembersTable).where(eq(projectMembersTable.projectId, params.data.id));
  return c.json(ListProjectMembersResponse.parse(members));
});

router.post("/projects/:id/members", async (c) => {
  const userId = c.get("userId");
  const params = InviteProjectMemberParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (role !== "owner") return c.json({ error: "Forbidden. Only owner can invite members." }, 403);

  const body = await c.req.json().catch(() => ({}));
  const parsed = InviteProjectMemberBody.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);

  const emailToInvite = parsed.data.email;

  const { CLERK_SECRET_KEY } = env<{ CLERK_SECRET_KEY: string }>(c);
  const clerkClient = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  const users = await clerkClient.users.getUserList({ emailAddress: [emailToInvite] });
  const invitedUserId = (users && users.data && users.data.length > 0) ? users.data[0].id : null;

  if (invitedUserId && invitedUserId === project.userId) {
    return c.json({ error: "Cannot invite the project owner." }, 400);
  }

  // Check if already a member or invited
  const existingConditions = [eq(projectMembersTable.projectId, project.id)];
  if (invitedUserId) {
    existingConditions.push(or(eq(projectMembersTable.userId, invitedUserId), eq(projectMembersTable.email, emailToInvite))!);
  } else {
    existingConditions.push(eq(projectMembersTable.email, emailToInvite));
  }

  const [existing] = await db.select().from(projectMembersTable)
    .where(and(...(existingConditions as any[])));
  
  if (existing) {
    return c.json({ error: "User is already a member or has a pending invite." }, 400);
  }

  const [newMember] = await db.insert(projectMembersTable)
    .values({
      projectId: project.id,
      userId: invitedUserId,
      email: emailToInvite,
      role: parsed.data.role
    }).returning();

  return c.json(InviteProjectMemberResponse.parse(newMember), 201);
});

router.delete("/projects/:id/members/:memberId", async (c) => {
  const userId = c.get("userId");
  const params = RemoveProjectMemberParams.safeParse(c.req.param());
  if (!params.success) return c.json({ error: params.error.message }, 400);

  const { project, role } = await checkProjectAccess(params.data.id, userId);
  if (!project) return c.json({ error: "Project not found" }, 404);
  
  const [memberToRemove] = await db.select().from(projectMembersTable).where(eq(projectMembersTable.id, params.data.memberId));
  if (!memberToRemove) return c.json({ error: "Member not found" }, 404);

  if (role !== "owner" && userId !== memberToRemove.userId) {
    return c.json({ error: "Forbidden." }, 403);
  }

  await db.delete(projectMembersTable)
    .where(eq(projectMembersTable.id, params.data.memberId));

  return new Response(null, { status: 204 });
});

export default router;
