import { db, activityLogTable } from "@workspace/db";

export async function logActivity(
  projectId: number,
  userId: string,
  action: 'created' | 'updated' | 'deleted',
  entityType: 'project' | 'transaction' | 'member' | 'change_order' | 'recurring' | 'photo',
  entityId: number | null,
  details?: any
) {
  try {
    await db.insert(activityLogTable).values({
      projectId,
      userId,
      action,
      entityType,
      entityId,
      details: details ? JSON.stringify(details) : null
    });
  } catch (error) {
    console.error("Failed to log activity:", error);
  }
}
