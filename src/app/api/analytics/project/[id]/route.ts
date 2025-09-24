import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getProjectAnalytics } from "@/lib/analytics";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: projectId } = await context.params;
    const membership = await prisma.projectMember.findFirst({ where: { projectId, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const cacheKey = `analytics:project:${projectId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });

    const stats = await getProjectAnalytics(projectId, 30, session.user.id);
    const payload = { stats, generatedAt: new Date().toISOString() };
    await cacheSet(cacheKey, payload, 60);
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  } catch (e) {
    console.error("[analytics.project]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
