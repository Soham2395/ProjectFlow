import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { cacheGet, cacheSet } from "@/lib/cache";
import { detectOverload, getProjectAnalytics } from "@/lib/analytics";
import { openaiText } from "@/lib/openai";

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });

    const membership = await prisma.projectMember.findFirst({ where: { projectId, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const cacheKey = `analytics:ai:${projectId}`;
    const cached = await cacheGet(cacheKey);
    if (cached) return NextResponse.json(cached, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });

    const stats = await getProjectAnalytics(projectId, 30, session.user.id);
    const overload = detectOverload(stats.workload);

    // Simple heuristics for risks
    const risks: string[] = [];
    if (stats.overdue.count > 0) risks.push(`${stats.overdue.count} overdue tasks`);
    if (overload.overloaded.length > 0) risks.push(`workload imbalance affecting ${overload.overloaded.length} member(s)`);
    if ((stats.completion.onTimeRate || 0) < 0.6) risks.push("low on-time completion rate (<60%)");

    // Naive predicted sprint completion based on velocity (average of last sprints)
    const avgVelocity = stats.velocity.length ? stats.velocity.reduce((a, b) => a + b.completed, 0) / stats.velocity.length : 0;
    const remaining = stats.burndown.length ? stats.burndown[stats.burndown.length - 1].remaining : 0;
    const predictedSprints = avgVelocity > 0 ? Math.ceil(remaining / avgVelocity) : null;

    const baseInsights = {
      overloadedMembers: overload.overloaded.map((o) => o.user),
      risks,
      suggestions: [
        ...overload.overloaded.map((o) => `Rebalance tasks from ${o.user.name || o.user.email} to under-utilized members.`),
        stats.overdue.count > 0 ? "Prioritize overdue tasks this week and renegotiate deadlines if needed." : null,
      ].filter(Boolean),
      predictedSprintCompletion: predictedSprints,
      context: {
        avgVelocity: Number(avgVelocity.toFixed(2)),
        remaining,
        onTimeRate: Number((stats.completion.onTimeRate * 100).toFixed(1)),
      },
    };

    // Optional: enrich with OpenAI
    const provider = (process.env.AI_ASSISTANT_PROVIDER || "").toLowerCase();
    const apiKey = process.env.OPENAI_API_KEY;
    let aiSummary: string | null = null;
    if (provider === "openai" && apiKey) {
      try {
        aiSummary = await openaiText({
          system: "You are an analytics assistant. I want a brief summary of the entire project analytics. Try to summarize t within 200-300 words.",
          user: `Data: ${JSON.stringify({
            workload: stats.workload,
            overdue: stats.overdue,
            completion: stats.completion,
            velocity: stats.velocity,
          })}`,
          temperature: 0.2,
        });
      } catch (e) {
        console.warn("[analytics.ai-insights] OpenAI error", e);
      }
    }

    const payload = { insights: baseInsights, aiSummary, generatedAt: new Date().toISOString() };
    await cacheSet(cacheKey, payload, 60);
    return NextResponse.json(payload, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  } catch (e) {
    console.error("[analytics.ai-insights]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
