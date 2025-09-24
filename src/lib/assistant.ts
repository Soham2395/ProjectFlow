import { prisma } from "@/lib/prisma";
import { Octokit } from "octokit";

export type AssistantContext = {
  projectId: string;
  limit?: number;
};

export async function getProjectStatus({ projectId }: AssistantContext) {
  const [project, tasks] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId } }),
    prisma.task.findMany({ where: { projectId } }),
  ]);
  const total = tasks.length;
  const done = tasks.filter((t: { status: string }) => t.status === "done").length;
  const inProgress = tasks.filter((t: { status: string }) => t.status === "in_progress").length;
  const todo = tasks.filter((t: { status: string }) => t.status === "todo").length;
  const overdue = tasks.filter((t: { dueDate: Date | null; status: string }) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "done").length;
  return {
    project: project ? { id: project.id, name: project.name, description: project.description } : null,
    tasks: { total, done, inProgress, todo, overdue },
  };
}

export async function getOverdueTasks({ projectId }: AssistantContext) {
  const tasks = await prisma.task.findMany({
    where: { projectId, status: { not: "done" }, dueDate: { lt: new Date() } },
    include: { assignee: { select: { id: true, name: true, email: true } }, labels: true },
    orderBy: { dueDate: "asc" },
  });
  return tasks;
}

export async function getWorkloadDistribution({ projectId }: AssistantContext) {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, skills: true } } },
  });
  const now = new Date();
  const data = await Promise.all(
    members.map(async (pm: { user: { id: string; name: string | null; email: string | null; skills: string[] } }) => {
      const tasks = await prisma.task.findMany({ where: { projectId, assigneeId: pm.user.id, status: { not: "done" } } });
      const score = tasks.reduce((acc: number, t: { priority: string; dueDate: Date | null }) => {
        let base = 1;
        if (t.priority === "high") base = 1.5;
        if (t.priority === "urgent") base = 2;
        const penalty = t.dueDate ? (new Date(t.dueDate) < now ? 1 : 0.2) : 0;
        return acc + base + penalty;
      }, 0);
      return {
        user: { id: pm.user.id, name: pm.user.name, email: pm.user.email, skills: pm.user.skills || [] },
        activeTasks: tasks.length,
        workloadScore: Number(score.toFixed(2)),
      };
    })
  );
  return data.sort((a, b) => b.workloadScore - a.workloadScore);
}

export async function getRecentCommits({ projectId, limit = 20 }: AssistantContext) {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project?.repoOwner || !project?.repoName) return [];
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const res = await octokit.request("GET /repos/{owner}/{repo}/commits", {
    owner: project.repoOwner,
    repo: project.repoName,
    per_page: Math.min(limit, 50),
  });
  return (res.data || []).map((c: any) => ({
    sha: c.sha,
    author: c.commit?.author?.name,
    date: c.commit?.author?.date,
    message: c.commit?.message,
    url: c.html_url,
  }));
}

// Placeholder: if you persist chat logs, fetch recent ones to enrich context
export async function getRecentChats({ projectId, limit = 50 }: AssistantContext) {
  // Assuming ChatMessage model per project already exists
  const msgs = await prisma.chatMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { sender: { select: { id: true, name: true, email: true } } },
  });
  return msgs.map((m: { id: string; senderId: string; sender: { name: string | null; email: string | null } | null; content: string | null; createdAt: Date }) => ({ id: m.id, sender: m.sender?.name || m.sender?.email || m.senderId, content: m.content, createdAt: m.createdAt }));
}

export async function createTaskNL({
  projectId,
  title,
  description,
  assignee,
  deadline,
  priority,
  labels,
}: {
  projectId: string;
  title: string;
  description?: string | null;
  assignee?: string | null; // user id or email/name to be resolved upstream
  deadline?: string | null; // ISO or natural handled upstream
  priority?: string | null;
  labels?: string[];
}) {
  const normalizedPriority = (priority || "medium").toLowerCase();
  const task = await prisma.task.create({
    data: {
      projectId,
      title: title.trim(),
      description: description || null,
      status: "todo",
      priority: normalizedPriority,
      dueDate: deadline ? new Date(deadline) : null,
      assigneeId: assignee || null,
      sortOrder: 0,
      ...(labels?.length
        ? {
            labels: {
              connectOrCreate: labels.map((name) => ({ where: { name }, create: { name, color: "#666" } })),
            },
          }
        : {}),
    },
  });
  return task;
}

export async function updateTaskNL({ id, field, value }: { id: string; field: string; value: any }) {
  const data: any = {};
  if (field === "status") data.status = String(value).toLowerCase();
  else if (field === "priority") data.priority = String(value).toLowerCase();
  else if (field === "assigneeId") data.assigneeId = value || null;
  else if (field === "title") data.title = String(value);
  else if (field === "description") data.description = String(value);
  else if (field === "dueDate") data.dueDate = value ? new Date(value) : null;
  else if (field === "labels" && Array.isArray(value)) {
    return prisma.task.update({
      where: { id },
      data: {
        labels: {
          set: [],
          connectOrCreate: value.map((name: string) => ({ where: { name }, create: { name, color: "#666" } })),
        },
      },
    });
  }
  return prisma.task.update({ where: { id }, data });
}
