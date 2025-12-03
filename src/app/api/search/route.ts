import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getUserProjectIds(userId: string): Promise<string[]> {
  const memberships = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });
  return memberships.map((m) => m.projectId);
}

// GET /api/search
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const type = url.searchParams.get("type") || "all"; // task | project | all
  const projectId = url.searchParams.get("projectId");
  const assigneeId = url.searchParams.get("assigneeId");
  const status = url.searchParams.get("status"); 
  const priority = url.searchParams.get("priority");
  const labelId = url.searchParams.get("labelId");
  const dueBefore = url.searchParams.get("dueBefore");
  const dueAfter = url.searchParams.get("dueAfter");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const cursor = url.searchParams.get("cursor");

  // Get accessible project IDs
  const accessibleProjectIds = await getUserProjectIds(session.user.id);
  if (accessibleProjectIds.length === 0) {
    return NextResponse.json({
      results: { tasks: [], projects: [], commits: [] },
      pagination: { nextCursor: null, hasMore: false },
    });
  }

  const results: {
    tasks: any[];
    projects: any[];
    commits: any[];
  } = {
    tasks: [],
    projects: [],
    commits: [],
  };

  // Search Projects
  if (type === "all" || type === "project") {
    const projectWhere: any = {
      id: { in: accessibleProjectIds },
    };

    if (q.trim()) {
      projectWhere.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    const projects = await prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        githubIntegrationEnabled: true,
        members: {
          select: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    results.projects = projects.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      createdAt: p.createdAt,
      githubIntegrationEnabled: p.githubIntegrationEnabled,
      memberCount: p.members.length,
      taskCount: p._count.tasks,
      members: p.members.map((m) => m.user),
    }));
  }

  // Search Tasks
  if (type === "all" || type === "task") {
    const taskWhere: any = {
      projectId: projectId
        ? projectId
        : { in: accessibleProjectIds },
    };

    if (q.trim()) {
      taskWhere.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }

    // Apply filters
    if (assigneeId) {
      taskWhere.assigneeId = assigneeId;
    }

    if (status) {
      const statuses = status.split(",").map((s) => s.trim().toLowerCase());
      taskWhere.status = { in: statuses };
    }

    if (priority) {
      const priorities = priority.split(",").map((p) => p.trim().toLowerCase());
      taskWhere.priority = { in: priorities };
    }

    if (labelId) {
      taskWhere.labels = {
        some: { id: labelId },
      };
    }

    if (dueBefore || dueAfter) {
      taskWhere.dueDate = {};
      if (dueBefore) {
        taskWhere.dueDate.lte = new Date(dueBefore);
      }
      if (dueAfter) {
        taskWhere.dueDate.gte = new Date(dueAfter);
      }
    }

    // Cursor-based pagination
    if (cursor) {
      taskWhere.id = { lt: cursor };
    }

    const tasks = await prisma.task.findMany({
      where: taskWhere,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
        labels: true,
        project: {
          select: { id: true, name: true },
        },
      },
      take: limit + 1, 
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const hasMore = tasks.length > limit;
    const tasksToReturn = hasMore ? tasks.slice(0, limit) : tasks;
    const nextCursor = hasMore ? tasksToReturn[tasksToReturn.length - 1].id : null;

    results.tasks = tasksToReturn.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      createdAt: t.createdAt,
      assignee: t.assignee,
      labels: t.labels,
      project: t.project,
    }));

    // Return pagination info for tasks
    if (type === "task") {
      return NextResponse.json({
        results,
        pagination: {
          nextCursor,
          hasMore,
        },
      });
    }
  }

  if ((type === "all" || type === "commit") && q.trim()) {
    results.commits = [];
  }

  return NextResponse.json({
    results,
    pagination: {
      nextCursor: null,
      hasMore: false,
    },
  });
}
