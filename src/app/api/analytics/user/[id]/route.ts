import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getUserAnalytics } from "@/lib/analytics";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id: userId } = await context.params;
    // Allow users to view their own analytics or project admins in future
    if (userId !== session.user.id) {
      // Check if user shares any project with the target user
      const share = await prisma.projectMember.findFirst({
        where: { userId: session.user.id },
        select: { projectId: true },
      });
      if (!share) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const cacheKey = `analytics:user:${userId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });

    const stats = await getUserAnalytics(userId);
    const payload = { stats, generatedAt: new Date().toISOString() };
    await cacheSet(cacheKey, payload, 60);
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  } catch (e) {
    console.error("[analytics.user]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
