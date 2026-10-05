import { z } from "zod";
import { LIMITS, NOTIFICATION_TYPES, TASK_PRIORITIES, TASK_STATUSES } from "./constants";

const id = z.string().min(1).max(64);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #4f46e5");
/** Calendar date as YYYY-MM-DD, or null to clear. */
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .nullable();

export const email = z.string().trim().toLowerCase().email("Enter a valid email address").max(254);

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(LIMITS.name),
  email,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .max(200, "Use at most 200 characters"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Enter a workspace name").max(LIMITS.name),
});
export const renameWorkspaceSchema = createWorkspaceSchema;
export const joinWorkspaceSchema = z.object({
  inviteCode: z.string().trim().min(6, "Enter the invite code").max(64),
});

export const createLabelSchema = z.object({
  name: z.string().trim().min(1, "Enter a label name").max(40),
  color: hexColor,
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const createClientSchema = z.object({
  name: z.string().trim().min(1, "Enter a client name").max(LIMITS.name),
  email: z.union([email, z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  color: hexColor,
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

/** Fields that can be edited on a task (directly by owners, or via a change request). */
export const taskFieldsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title").max(LIMITS.title),
  description: z.string().max(LIMITS.description),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  clientId: id.nullable(),
  startDate: dateOnly,
  endDate: dateOnly,
  dueDate: dateOnly,
  assigneeIds: z.array(id).max(50),
  ownerIds: z.array(id).min(1, "A task needs at least one owner").max(50),
  labelIds: z.array(id).max(50),
});
export type TaskFields = z.infer<typeof taskFieldsSchema>;
export type TaskFieldKey = keyof TaskFields;

const withDateOrder = <T extends z.ZodType<Partial<TaskFields>>>(schema: T) =>
  schema.refine(
    (v) => !v.startDate || !v.endDate || v.startDate <= v.endDate,
    { message: "End date can't be before the start date", path: ["endDate"] },
  );

export const taskChangesSchema = withDateOrder(
  taskFieldsSchema.partial().refine((v) => Object.keys(v).length > 0, "Nothing to change"),
);
export type TaskChanges = z.infer<typeof taskChangesSchema>;

export const createTaskSchema = withDateOrder(
  taskFieldsSchema
    .partial()
    .required({ title: true })
    .extend({ parentId: id.nullable().optional() }),
);
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  baseVersion: z.number().int().min(1),
  changes: taskChangesSchema,
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  status: z.enum(TASK_STATUSES),
  beforeId: id.nullable(),
  afterId: id.nullable(),
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const checklistCreateSchema = z.object({
  text: z.string().trim().min(1, "Enter an item").max(LIMITS.checklistText),
});
export const checklistUpdateSchema = z
  .object({
    text: z.string().trim().min(1).max(LIMITS.checklistText).optional(),
    done: z.boolean().optional(),
  })
  .refine((v) => v.text !== undefined || v.done !== undefined, "Nothing to change");

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, "Write a comment first").max(LIMITS.comment),
  mentionIds: z.array(id).max(50).default([]),
});
export type CommentCreateInput = z.input<typeof commentCreateSchema>;

export const reviewChangeRequestSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const deleteWorkspaceSchema = z.object({
  /** The workspace's name, typed back to confirm. */
  confirmName: z.string().trim().min(1, "Type the workspace name to confirm"),
});

export const notificationPrefsSchema = z
  .object(Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, z.boolean()])) as Record<(typeof NOTIFICATION_TYPES)[number], z.ZodBoolean>)
  .partial();

export const createDocSchema = z.object({
  title: z.string().trim().min(1, "Give the doc a title").max(LIMITS.title),
  body: z.string().max(LIMITS.docBody).optional(),
  clientId: id.nullable().optional(),
});
export type CreateDocInput = z.infer<typeof createDocSchema>;

export const updateDocSchema = z
  .object({
    title: z.string().trim().min(1, "Give the doc a title").max(LIMITS.title),
    body: z.string().max(LIMITS.docBody),
    clientId: id.nullable(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change");
export type UpdateDocInput = z.infer<typeof updateDocSchema>;

/** Uploads travel as base64 inside JSON, so they pass the same same-origin JSON guard as everything else. */
export const uploadDocSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileType: z.string().trim().max(120).default("application/octet-stream"),
  dataBase64: z
    .string()
    .min(1, "The file is empty")
    .max(Math.ceil((LIMITS.uploadBytes * 4) / 3) + 4, "Files can be at most 5 MB")
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "The file couldn't be read"),
  clientId: id.nullable().optional(),
});
export type UploadDocInput = z.input<typeof uploadDocSchema>;
