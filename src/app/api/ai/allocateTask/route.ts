import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { allocateWithAI, type AllocationInput } from "@/lib/ai-allocation";

// POST /api/ai/allocateTask
// Body: { task: { id?, title, description?, priority, labels?: {name}[], dueDate?, projectId }, persist?: boolean }
// Returns: { suggestion: { userId, confidence } | null }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (process.env.AI_ALLOCATION_ENABLED !== "true") {
    return NextResponse.json({ suggestion: null, disabled: true });
  }

  const body = await req.json().catch(() => ({}));
  const { task, persist } = body as { task?: AllocationInput["task"]; persist?: boolean };
  if (!task) {
    return NextResponse.json({ error: "Please provide task details to get an AI suggestion." }, { status: 400 });
  }
  if (!task.title) {
    return NextResponse.json({ error: "Please enter a task title to get an AI suggestion." }, { status: 400 });
  }
  if (!task.priority) {
    return NextResponse.json({ error: "Please select a priority to get an AI suggestion." }, { status: 400 });
  }
  if (!task.projectId) {
    return NextResponse.json({ error: "We couldn't detect the project. Please reopen the modal and try again." }, { status: 400 });
  }

  // Ensure caller is a member of the project
  const member = await prisma.projectMember.findFirst({ where: { userId: session.user.id, projectId: task.projectId }, select: { id: true } });
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Build team data: project members with skills and computed workloadScore
  const projectMembers = await prisma.projectMember.findMany({
    where: { projectId: task.projectId },
    select: { user: { select: { id: true, name: true, email: true, skills: true } } },
  });

  const now = new Date();
  const team = await Promise.all(
    projectMembers.map(async (pm: { user: { id: string; name: string | null; email: string | null; skills: string[] } }) => {
      const userId = pm.user.id;
      // Active tasks assigned to this user in this project
      const tasks = await prisma.task.findMany({
        where: { projectId: task.projectId, assigneeId: userId, status: { not: "done" } },
        select: { dueDate: true, priority: true },
      });
      let score = 0;
      for (const t of tasks) {
        let base = 1;
        if (t.priority === "high") base = 1.5;
        if (t.priority === "urgent") base = 2;
        let deadlinePenalty = 0;
        if (t.dueDate) {
          const days = Math.max(0, Math.ceil((new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          deadlinePenalty = days <= 3 ? 1 : days <= 7 ? 0.5 : 0.1;
        }
        score += base + deadlinePenalty;
      }
      return {
        id: userId,
        name: pm.user.name,
        email: pm.user.email,
        skills: pm.user.skills || [],
        workloadScore: Number(score.toFixed(2)),
      };
    })
  );

  const suggestion = await allocateWithAI({ task, team });

  if (persist && task.id && suggestion?.userId) {
    try {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          aiSuggestedAssigneeId: suggestion.userId,
          allocationConfidence: suggestion.confidence,
        },
      });
    } catch (e) {
      // ignore persistence errors in this endpoint
      console.error("Failed to persist AI suggestion", e);
    }
  }

  return NextResponse.json({ suggestion });
}
