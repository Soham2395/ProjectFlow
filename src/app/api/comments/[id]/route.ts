import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

async function isAdminOfProject(userId: string, projectId: string) {
  const m = await prisma.projectMember.findFirst({ where: { userId, projectId }, select: { role: true } });
  return m?.role === "admin";
}

// PATCH /api/comments/[id] { content }
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const { content } = body as { content?: string };
  if (!content || !content.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, task: { select: { projectId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canAdmin = await isAdminOfProject(session.user.id, existing.task.projectId);
  if (existing.userId !== session.user.id && !canAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updated = await prisma.comment.update({ where: { id }, data: { content: content.trim() }, include: { user: { select: { id: true, name: true, email: true, image: true } } } });
  return NextResponse.json({ comment: { id: updated.id, content: updated.content, createdAt: updated.createdAt, author: updated.user } });
}

// DELETE /api/comments/[id]
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const existing = await prisma.comment.findUnique({
    where: { id },
    select: { userId: true, task: { select: { projectId: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canAdmin = await isAdminOfProject(session.user.id, existing.task.projectId);
  if (existing.userId !== session.user.id && !canAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.comment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
