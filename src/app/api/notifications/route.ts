import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

// GET /api/notifications?status=all|unread&projectId=&cursor=&limit=20
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") || "all").toLowerCase();
    const projectId = searchParams.get("projectId") || undefined;
    const cursor = searchParams.get("cursor") || undefined;
    const limit = Math.min(Math.max(Number(searchParams.get("limit") || 20), 1), 50);

    const where: any = { userId: session.user.id };
    if (status === "unread") where.isRead = false;
    if (projectId) where.projectId = projectId;

    // Sync pending invitations (by email) into notifications for this user
    if (session.user.email) {
      const email = session.user.email.toLowerCase();
      const origin = `${new URL(request.url).protocol}//${new URL(request.url).host}`;
      const invites = await prisma.invitation.findMany({
        where: { email, status: "pending" },
        include: { project: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      for (const inv of invites) {
        // Skip if no project (org-only invitations handled separately)
        if (!inv.project) continue;

        // Avoid duplicate in-app notifications for the same project invite
        const existing = await prisma.notification.findFirst({
          where: { userId: session.user.id, projectId: inv.projectId, type: "invitation" },
        });
        if (!existing) {
          const acceptUrl = `${origin}/invitations/accept?token=${inv.token}`;
          await createNotification({
            userId: session.user.id,
            projectId: inv.projectId,
            type: "invitation",
            payload: { projectName: inv.project.name, invitedBy: inv.invitedBy ?? null, acceptUrl },
          });
        }
      }
    }

    const items = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const data = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    // Unread count for badge
    const unread = await prisma.notification.count({ where: { userId: session.user.id, isRead: false } });

    return NextResponse.json({ notifications: data, nextCursor, unread });
  } catch (e) {
    console.error("[notifications.GET]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
