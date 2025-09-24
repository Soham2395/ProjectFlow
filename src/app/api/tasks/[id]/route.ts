import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

// Helper: check project membership by task id
async function requireMemberByTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return false;
  const member = await prisma.projectMember.findFirst({ where: { userId, projectId: task.projectId }, select: { id: true } });
  return !!member;
}

// GET /api/tasks/[id]
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const isMember = await requireMemberByTask(session.user.id, id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      aiSuggestedAssignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ task });
}

// PATCH /api/tasks/[id]
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const isMember = await requireMemberByTask(session.user.id, id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { title, description, status, priority, dueDate, assigneeId, labels } = body as {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    dueDate?: string | null;
    assigneeId?: string | null;
    labels?: { name: string; color: string }[];
  };

  const data: any = {};
  if (typeof title === "string") data.title = title.trim();
  if (typeof description !== "undefined") data.description = description?.toString().trim() || null;
  if (typeof status === "string") data.status = status.toLowerCase();
  if (typeof priority === "string") data.priority = priority.toLowerCase();
  if (typeof dueDate !== "undefined") data.dueDate = dueDate ? new Date(dueDate) : null;
  if (typeof assigneeId !== "undefined") data.assigneeId = assigneeId || null;

  // Manage labels: replace with provided set when supplied
  let labelsOp: any = undefined;
  if (Array.isArray(labels)) {
    labelsOp = {
      set: [], // clear existing
      connectOrCreate: labels.map((l) => ({
        where: { name: l.name.trim() },
        create: { name: l.name.trim(), color: l.color || "#666" },
      })),
    };
  }

  const task = await prisma.task.update({
    where: { id },
    data: { ...data, ...(labelsOp ? { labels: labelsOp } : {}) },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      aiSuggestedAssignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json({ task });
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const isMember = await requireMemberByTask(session.user.id, id);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.attachment.deleteMany({ where: { taskId: id } });
  await prisma.comment.deleteMany({ where: { taskId: id } });
  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
