import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ReportsClient from "@/components/analytics/reports-client";
import { getProjectAnalytics, detectOverload } from "@/lib/analytics";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function ProjectReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const member = await prisma.projectMember.findFirst({ where: { projectId, userId: session.user.id } });
  if (!member) redirect("/dashboard");

  const stats = await getProjectAnalytics(projectId, 30, session.user.id);
  const overload = detectOverload(stats.workload);
  const avgVelocity = stats.velocity.length ? stats.velocity.reduce((a, b) => a + b.completed, 0) / stats.velocity.length : 0;
  const remaining = stats.burndown.length ? stats.burndown[stats.burndown.length - 1].remaining : 0;
  const predictedSprints = avgVelocity > 0 ? Math.ceil(remaining / avgVelocity) : null;
  const insights = {
    insights: {
      overloadedMembers: overload.overloaded.map((o) => o.user),
      risks: [
        ...(stats.overdue.count > 0 ? [`${stats.overdue.count} overdue tasks`] : []),
        ...(overload.overloaded.length > 0 ? [`workload imbalance affecting ${overload.overloaded.length} member(s)`] : []),
        ...((stats.completion.onTimeRate || 0) < 0.6 ? ["low on-time completion rate (<60%)"] : []),
      ],
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
    },
    aiSummary: null,
  } as any;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-4">
        <Link
          href={`/project/${projectId}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visualize project health, productivity, and risks.</p>
      </div>

      {!stats ? (
        <div className="rounded border p-6 text-sm text-muted-foreground">No analytics available.</div>
      ) : (
        <ReportsClient projectId={projectId} stats={stats as any} insights={insights} />
      )}
    </main>
  );
}
