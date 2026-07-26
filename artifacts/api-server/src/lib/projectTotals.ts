import { inArray, sql } from "drizzle-orm";
import { db, transactionsTable, type Project } from "@workspace/db";

export type ProjectWithTotals = Omit<Project, 'budget'> & {
  budget: number | null;
  totalReceived: number;
  totalSpent: number;
  balance: number;
};

interface TotalsRow {
  projectId: number;
  totalReceived: string | null;
  totalSpent: string | null;
}

export async function getTotalsByProjectIds(
  projectIds: number[],
): Promise<Map<number, { totalReceived: number; totalSpent: number }>> {
  const map = new Map<number, { totalReceived: number; totalSpent: number }>();
  if (projectIds.length === 0) {
    return map;
  }

  const rows = (await db
    .select({
      projectId: transactionsTable.projectId,
      totalReceived: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'deposit' THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
      totalSpent: sql<string>`COALESCE(SUM(CASE WHEN ${transactionsTable.type} = 'expense' THEN ${transactionsTable.amount} ELSE 0 END), 0)`,
    })
    .from(transactionsTable)
    .where(inArray(transactionsTable.projectId, projectIds))
    .groupBy(transactionsTable.projectId)) as TotalsRow[];

  for (const row of rows) {
    map.set(row.projectId, {
      totalReceived: Number(row.totalReceived ?? 0),
      totalSpent: Number(row.totalSpent ?? 0),
    });
  }

  return map;
}

export async function attachTotals(
  projects: Project[],
): Promise<ProjectWithTotals[]> {
  const totals = await getTotalsByProjectIds(projects.map((p) => p.id));
  return projects.map((project) => {
    const t = totals.get(project.id) ?? { totalReceived: 0, totalSpent: 0 };
    return {
      ...project,
      budget: project.budget !== null && project.budget !== undefined ? Number(project.budget) : null,
      totalReceived: t.totalReceived,
      totalSpent: t.totalSpent,
      balance: t.totalReceived - t.totalSpent,
    };
  });
}

export async function attachTotalsSingle(
  project: Project,
): Promise<ProjectWithTotals> {
  const [withTotals] = await attachTotals([project]);
  return withTotals as ProjectWithTotals;
}
