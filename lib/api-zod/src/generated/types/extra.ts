import * as zod from 'zod';

export interface ActivityLog {
  id: number;
  projectId: number;
  userId: string;
  action: 'created' | 'updated' | 'deleted';
  entityType: 'project' | 'transaction' | 'member' | 'change_order' | 'recurring' | 'photo';
  entityId: number | null;
  details: any;
  createdAt: Date;
}

export interface RecurringTransaction {
  id: number;
  projectId: number;
  userId: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  nextRunDate: string;
  isActive: boolean;
  templateData: any;
  createdAt: Date;
}

export interface ChangeOrder {
  id: number;
  projectId: number;
  userId: string;
  title: string;
  description: string | null;
  amountChange: number;
  status: 'pending' | 'approved' | 'rejected';
  approvedAt: Date | null;
  createdAt: Date;
}

export interface SitePhoto {
  id: number;
  projectId: number;
  userId: string;
  photoPath: string;
  caption: string | null;
  takenAt: string;
  createdAt: Date;
}

export const ActivityLogSchema = zod.object({
  id: zod.number(),
  projectId: zod.number(),
  userId: zod.string(),
  action: zod.enum(['created', 'updated', 'deleted']),
  entityType: zod.enum(['project', 'transaction', 'member', 'change_order', 'recurring', 'photo']),
  entityId: zod.number().nullable(),
  details: zod.any(),
  createdAt: zod.coerce.date(),
});

export const RecurringTransactionSchema = zod.object({
  id: zod.number(),
  projectId: zod.number(),
  userId: zod.string(),
  frequency: zod.enum(['weekly', 'biweekly', 'monthly']),
  nextRunDate: zod.string(),
  isActive: zod.boolean(),
  templateData: zod.any(),
  createdAt: zod.coerce.date(),
});

export const ChangeOrderSchema = zod.object({
  id: zod.number(),
  projectId: zod.number(),
  userId: zod.string(),
  title: zod.string(),
  description: zod.string().nullable(),
  amountChange: zod.number(),
  status: zod.enum(['pending', 'approved', 'rejected']),
  approvedAt: zod.coerce.date().nullable(),
  createdAt: zod.coerce.date(),
});

export const SitePhotoSchema = zod.object({
  id: zod.number(),
  projectId: zod.number(),
  userId: zod.string(),
  photoPath: zod.string(),
  caption: zod.string().nullable(),
  takenAt: zod.string(),
  createdAt: zod.coerce.date(),
});
