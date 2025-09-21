import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireMemberByTask(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return false;
  const member = await prisma.projectMember.findFirst({ where: { userId, projectId: task.projectId }, select: { id: true } });
  return !!member;
}

// GET /api/tasks/[id]/comments
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: taskId } = await ctx.params;

  const ok = await requireMemberByTask(session.user.id, taskId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  type CommentWithUser = {
    id: string;
    content: string;
    createdAt: Date;
    user: { id: string; name: string | null; email: string | null; image: string | null };
  };

  const comments: CommentWithUser[] = await prisma.comment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  // Map to { id, content, createdAt, author }
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: c.user,
    })),
  });
}

// POST /api/tasks/[id]/comments { content }
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: taskId } = await ctx.params;

  const ok = await requireMemberByTask(session.user.id, taskId);
  if (!ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content } = (await req.json().catch(() => ({}))) as { content?: string };
  if (!content || !content.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const created = await prisma.comment.create({
    data: { taskId, userId: session.user.id, content: content.trim() },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return NextResponse.json({
    comment: { id: created.id, content: created.content, createdAt: created.createdAt, author: created.user },
  }, { status: 201 });
}

