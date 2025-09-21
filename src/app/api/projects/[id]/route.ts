import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

// Helper to check if current user is admin of the project
async function requireAdmin(userId: string, projectId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { userId, projectId },
    select: { role: true },
  });
  if (!member || member.role !== "admin") return false;
  return true;
}

// PATCH /api/projects/[id] - update name/description or member emails
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await ctx.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = await requireAdmin(session.user.id, projectId);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { name, description, memberEmails } = body as {
    name?: string;
    description?: string | null;
    memberEmails?: string[];
  };

  const data: any = {};
  if (typeof name === "string") data.name = name.trim();
  if (typeof description !== "undefined") data.description = description?.toString().trim() || null;

  // Optional: create invitations for new member emails (no removal of existing members here).
  if (Array.isArray(memberEmails) && memberEmails.length) {
    const emails = memberEmails.map((e) => e?.toLowerCase().trim()).filter(Boolean) as string[];
    if (emails.length) {
      const uniqueEmails = Array.from(new Set(emails));
      await prisma.$transaction(
        uniqueEmails.map((email) =>
          prisma.invitation.upsert({
            where: { email_projectId_status: { email, projectId, status: "pending" } } as any,
            create: {
              email,
              projectId,
              role: "member",
              token: crypto.randomUUID(),
              status: "pending",
              invitedBy: session.user.id,
            },
            update: {},
          })
        )
      );
    }
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data,
    include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } }, invitations: true },
  });

  return NextResponse.json({ project });
}

// DELETE /api/projects/[id] - admin only
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  const isAdmin = await requireAdmin(session.user.id, projectId);
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Manually delete dependent records to satisfy FK constraints
  await prisma.$transaction(async (tx: any) => {
    // Find all task ids for the project
    const tasks = await tx.task.findMany({ where: { projectId }, select: { id: true } });
    const taskIds = tasks.map((t: { id: string }) => t.id);

    if (taskIds.length > 0) {
      await tx.attachment.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.comment.deleteMany({ where: { taskId: { in: taskIds } } });
      // Labels M2M join rows are handled automatically when tasks are deleted
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    // Project members and invitations
    await tx.projectMember.deleteMany({ where: { projectId } });
    await tx.invitation.deleteMany({ where: { projectId } });

    // Finally delete the project
    await tx.project.delete({ where: { id: projectId } });
  });
  return NextResponse.json({ ok: true });
}
