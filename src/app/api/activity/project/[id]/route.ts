import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/activity/project/[id]?cursor=&limit=30
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await context.params;

    const membership = await prisma.projectMember.findFirst({ where: { projectId, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Basic listing (latest first)
    const items = await prisma.activity.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        actor: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    // Group by day
    const groups: Record<string, typeof items> = {};
    for (const a of items) {
      const key = a.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      (groups[key] ||= []).push(a);
    }
    const grouped = Object.entries(groups)
      .map(([date, entries]) => ({ date, entries }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    return NextResponse.json({ activity: grouped });
  } catch (e) {
    console.error("[activity.project]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
