import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createActivity, createNotification } from "@/lib/notifications";

// Helper: ensure the user is a member of the project
async function requireMember(userId: string, projectId: string) {
  const member = await prisma.projectMember.findFirst({ where: { userId, projectId }, select: { id: true } });
  return !!member;
}

// GET /api/tasks?projectId=...
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

  const isMember = await requireMember(session.user.id, projectId);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      aiSuggestedAssignee: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: [
      { status: "asc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });

  return NextResponse.json({ tasks });
}

// POST /api/tasks - create a task
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId, title, description, status, priority, dueDate, assigneeId, labels } = body as {
    projectId?: string;
    title?: string;
    description?: string | null;
    status?: string; // "todo" | "in_progress" | "done" (we will normalize inputs)
    priority?: string; // "low" | "medium" | "high" | "urgent"
    dueDate?: string | null; // ISO
    assigneeId?: string | null;
    labels?: { name: string; color: string }[];
  };

  if (!projectId || !title?.trim()) {
    return NextResponse.json({ error: "projectId and title are required" }, { status: 400 });
  }

  const isMember = await requireMember(session.user.id, projectId);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const normalizedStatus = (status || "todo").toLowerCase();
  const normalizedPriority = (priority || "medium").toLowerCase();

  // Compute next sortOrder within the target status column
  const last = await prisma.task.findFirst({
    where: { projectId, status: normalizedStatus },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  const nextOrder = (last?.sortOrder ?? 0) + 1;

  const task = await prisma.task.create({
    data: {
      projectId,
      title: title.trim(),
      description: description?.toString().trim() || null,
      status: normalizedStatus,
      priority: normalizedPriority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assigneeId: assigneeId || null,
      sortOrder: nextOrder,
      // labels relation: connect or create by name
      ...(Array.isArray(labels) && labels.length
        ? {
            labels: {
              connectOrCreate: labels.map((l) => ({
                where: { name: l.name.trim() },
                create: { name: l.name.trim(), color: l.color || "#666" },
              })),
            },
          }
        : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      aiSuggestedAssignee: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Emit activity and notify assignee if any
  try {
    await createActivity({
      projectId,
      actorId: session.user.id,
      verb: "created",
      targetId: task.id,
      summary: `Created task "${task.title}"`,
      meta: { taskId: task.id },
    });
    if (task.assigneeId) {
      await createNotification({
        userId: task.assigneeId,
        projectId,
        type: "task_assigned",
        payload: { taskId: task.id, title: task.title },
      });
    }
  } catch {}

  // Optionally call AI allocation service to suggest an assignee on creation
  try {
    if (process.env.AI_ALLOCATION_ENABLED === "true") {
      const url = new URL(req.url);
      const origin = `${url.protocol}//${url.host}`;
      const res = await fetch(`${origin}/api/ai/allocateTask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: {
            id: task.id,
            title: task.title,
            description: task.description,
            priority: task.priority,
            labels: (task.labels || []).map((l: { name: string }) => ({ name: l.name })),
            dueDate: task.dueDate,
            projectId: task.projectId,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.suggestion?.userId) {
          const updated = await prisma.task.update({
            where: { id: task.id },
            data: {
              aiSuggestedAssigneeId: data.suggestion.userId,
              allocationConfidence: typeof data.suggestion.confidence === "number" ? data.suggestion.confidence : null,
            },
            include: {
              assignee: { select: { id: true, name: true, email: true, image: true } },
              labels: true,
              aiSuggestedAssignee: { select: { id: true, name: true, email: true, image: true } },
            },
          });
          return NextResponse.json({ task: updated }, { status: 201 });
        }
      }
    }
  } catch (e) {
    // Do not block task creation on AI errors
    console.error("AI allocation error", e);
  }

  return NextResponse.json({ task }, { status: 201 });
}

// PATCH /api/tasks - batch move/reorder tasks
// Body: { projectId: string, updates: Array<{ id: string, status: string, sortOrder: number }> }
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId, updates } = body as {
    projectId?: string;
    updates?: { id: string; status: string; sortOrder: number }[];
  };

  if (!projectId || !Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "projectId and updates required" }, { status: 400 });
  }

  const isMember = await requireMember(session.user.id, projectId);
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.$transaction(
    updates.map((u) => {
      const next = u.status.toLowerCase();
      return prisma.task.update({
        where: { id: u.id },
        data: {
          status: next,
          sortOrder: u.sortOrder,
          completedAt: next === "done" ? new Date() : null,
        },
      });
    })
  );

  // Record a single activity entry summarizing the batch update
  try {
    await createActivity({
      projectId,
      actorId: session.user.id,
      verb: "updated",
      targetId: null,
      summary: `Updated ${updates.length} task(s)`,
      meta: { updates },
    });
  } catch {}

  return NextResponse.json({ ok: true });
}
