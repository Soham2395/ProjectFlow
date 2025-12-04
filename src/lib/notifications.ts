import { prisma } from "@/lib/prisma";
import { getIO } from "@/lib/socket-server";

export type NotificationType =
  | "task_assigned"
  | "comment"
  | "mention"
  | "github_commit"
  | "ai_update";

export async function createNotification(input: {
  userId: string;
  projectId?: string | null;
  organizationId?: string | null;
  type: NotificationType | string;
  payload: Record<string, unknown>;
}) {
  const { userId, projectId = null, organizationId = null, type, payload } = input;
  const notif = await prisma.notification.create({
    data: {
      userId,
      projectId,
      organizationId,
      type,
      payload: payload as any,
    },
  });

  // Emit to user's personal room
  const io = getIO();
  if (io) io.to(`user:${userId}`).emit("notification:new", notif);

  return notif;
}

export async function markNotificationsRead(input: {
  userId: string;
  ids?: string[]; // if omitted, mark all as read
  projectId?: string;
}) {
  const { userId, ids, projectId } = input;
  const where: any = { userId, isRead: false };
  if (ids && ids.length) where.id = { in: ids };
  if (projectId) where.projectId = projectId;

  const res = await prisma.notification.updateMany({
    where,
    data: { isRead: true },
  });
  return res.count;
}

export async function createActivity(input: {
  projectId: string;
  organizationId: string;
  actorId?: string | null;
  verb: string;
  targetId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  const { projectId, organizationId, actorId = null, verb, targetId = null, summary, meta = {} } = input;
  const activity = await prisma.activity.create({
    data: {
      projectId,
      organizationId,
      actorId,
      verb,
      targetId,
      summary,
      meta: meta as any,
    },
    include: {
      actor: { select: { id: true, name: true, email: true, image: true } },
      project: { select: { id: true, name: true } },
    },
  });

  // Emit to project room
  const io = getIO();
  if (io) io.to(projectId).emit("activity:new", activity);

  return activity;
}
