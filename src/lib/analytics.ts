import { prisma } from "@/lib/prisma";
import { getOctokitForProject } from "@/lib/github";
import { differenceInCalendarDays, isBefore } from "date-fns";

// Local minimal interfaces to avoid depending on generated Prisma types at build time
type TTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: Date | null;
  projectId: string;
  assigneeId: string | null;
  createdAt: Date;
  completedAt?: Date | null;
};
type TMember = { user: { id: string; name: string | null; email: string | null } };
type TChatMessage = { id: string; createdAt: Date };

export type ProjectAnalytics = {
  project: { id: string; name: string } | null;
  tasksByStatus: { status: string; count: number }[];
  overdue: { count: number; overdueTasks: string[] };
  completion: {
    averageDaysToComplete: number | null;
    completedCount: number;
    onTimeRate: number; // 0..1
    overdueCompletionRate: number; // 0..1
  };
  workload: { user: { id: string; name: string | null; email: string | null }; count: number }[];
  burndown: { date: string; remaining: number }[];
  velocity: { sprint: string; completed: number }[];
  cumulativeFlow: { date: string; todo: number; in_progress: number; done: number }[];
  milestones: { title: string; dueDate: string | null; completed: boolean }[];
  activity: { date: string; commits: number; updates: number; messages: number }[];
};

export async function getProjectAnalytics(projectId: string, days = 30, requesterUserId?: string): Promise<ProjectAnalytics> {
  const [project, tasks, members, messages] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, githubIntegrationEnabled: true, repoOwner: true, repoName: true } }),
    prisma.task.findMany({ where: { projectId } }) as unknown as Promise<TTask[]>,
    prisma.projectMember.findMany({ where: { projectId }, include: { user: true } }) as unknown as Promise<TMember[]>,
    prisma.chatMessage.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } }) as unknown as Promise<TChatMessage[]>,
  ]);

  const now = new Date();
  // Tasks by status
  const statusMap: Record<string, number> = {};
  (tasks as TTask[]).forEach((t: TTask) => {
    const s = (t.status || "todo").toLowerCase();
    statusMap[s] = (statusMap[s] || 0) + 1;
  });
  const tasksByStatus = ["todo", "in_progress", "done"].map((s) => ({ status: s, count: statusMap[s] || 0 }));

  // Overdue
  const overdueTasks = (tasks as TTask[]).filter((t: TTask) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done");
  const overdue = { count: overdueTasks.length, overdueTasks: overdueTasks.map((t: TTask) => t.id) };

  // Completion metrics
  const completed = (tasks as TTask[]).filter((t: TTask) => t.status === "done" && t.completedAt);
  const durations = completed
    .map((t: TTask) => {
      const start = t.createdAt;
      const end = t.completedAt!;
      return Math.max(0, differenceInCalendarDays(end, start));
    })
    .filter((d) => Number.isFinite(d));
  const averageDaysToComplete = durations.length ? Number((durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)) : null;
  const completedCount = completed.length;
  const onTime = completed.filter((t) => (t.dueDate ? isBefore(t.completedAt!, t.dueDate) || +t.completedAt! === +t.dueDate! : true)).length;
  const onTimeRate = completedCount ? onTime / completedCount : 0;
  const overdueCompletionRate = completedCount ? 1 - onTimeRate : 0;

  // Workload per user
  const byAssignee: Record<string, number> = {};
  (tasks as TTask[]).forEach((t: TTask) => {
    if (t.assigneeId) byAssignee[t.assigneeId] = (byAssignee[t.assigneeId] || 0) + 1;
  });
  const workload = (members as TMember[])
    .map((m: TMember) => ({ user: { id: m.user.id, name: m.user.name, email: m.user.email }, count: byAssignee[m.user.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  // Burndown (remaining tasks over last N days)
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days + 1);
  const burndown: { date: string; remaining: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const remaining = (tasks as TTask[]).filter((t: TTask) => t.createdAt <= d && !(t.completedAt && t.completedAt <= d)).length;
    burndown.push({ date: d.toISOString().slice(0, 10), remaining });
  }

  // Velocity (completed per 1-week sprint windows)
  const velocityWindows = 4; // last 4 sprints (~4 weeks)
  const velocity: { sprint: string; completed: number }[] = [];
  for (let i = velocityWindows - 1; i >= 0; i--) {
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const doneCount = (tasks as TTask[]).filter((t: TTask) => t.completedAt && t.completedAt >= start && t.completedAt <= end).length;
    velocity.push({ sprint: `${start.toISOString().slice(5, 10)}..${end.toISOString().slice(5, 10)}`, completed: doneCount });
  }

  // Cumulative flow (status counts over time)
  const cumulativeFlow: { date: string; todo: number; in_progress: number; done: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const todo = (tasks as TTask[]).filter((t: TTask) => t.createdAt <= d && t.status === "todo" && !(t.completedAt && t.completedAt <= d)).length;
    const inProgress = (tasks as TTask[]).filter((t: TTask) => t.createdAt <= d && t.status === "in_progress" && !(t.completedAt && t.completedAt <= d)).length;
    const done = (tasks as TTask[]).filter((t: TTask) => t.completedAt && t.completedAt <= d).length;
    cumulativeFlow.push({ date: d.toISOString().slice(0, 10), todo, in_progress: inProgress, done });
  }

  // Milestones (approximate by high priority tasks with due dates)
  const milestones = (tasks as TTask[])
    .filter((t: TTask) => t.priority === "high" || t.priority === "urgent")
    .map((t: TTask) => ({ title: t.title, dueDate: t.dueDate ? t.dueDate.toISOString() : null, completed: t.status === "done" }));

  // Activity (messages + task updates + commits if GitHub configured)
  const byDate: Record<string, { commits: number; updates: number; messages: number }> = {};
  // messages
  (messages as TChatMessage[]).forEach((m: TChatMessage) => {
    const day = m.createdAt.toISOString().slice(0, 10);
    byDate[day] = byDate[day] || { commits: 0, updates: 0, messages: 0 };
    byDate[day].messages += 1;
  });
  // task updates: created + completed per day over the window
  const startActivityDate = new Date(now);
  startActivityDate.setDate(startActivityDate.getDate() - days + 1);
  for (let i = 0; i < days; i++) {
    const d = new Date(startActivityDate);
    d.setDate(startActivityDate.getDate() + i);
    const day = d.toISOString().slice(0, 10);
    const created = (tasks as TTask[]).filter((t: TTask) => t.createdAt.toISOString().slice(0, 10) === day).length;
    const completed = (tasks as TTask[]).filter((t: TTask) => t.completedAt && t.completedAt.toISOString().slice(0, 10) === day).length;
    if (created || completed) {
      byDate[day] = byDate[day] || { commits: 0, updates: 0, messages: 0 };
      byDate[day].updates += created + completed;
    }
  }
  // commits via GitHub integration if available
  if (project?.githubIntegrationEnabled && project.repoOwner && project.repoName && requesterUserId) {
    try {
      const octokit = await getOctokitForProject(projectId, requesterUserId);
      if (octokit) {
        const since = startActivityDate.toISOString();
        const until = now.toISOString();
        const commitsResp = await octokit.rest.repos.listCommits({ owner: project.repoOwner as string, repo: project.repoName as string, since, until, per_page: 100 });
        const commits = commitsResp.data || [];
        commits.forEach((c: any) => {
          const dt = c.commit?.author?.date || c.commit?.committer?.date;
          if (!dt) return;
          const day = new Date(dt).toISOString().slice(0, 10);
          byDate[day] = byDate[day] || { commits: 0, updates: 0, messages: 0 };
          byDate[day].commits += 1;
        });
      }
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[analytics] failed to fetch commits for activity", e);
      }
    }
  }
  const activity = Object.entries(byDate)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]: [string, { commits: number; updates: number; messages: number }]) => ({ date, ...v }));

  return {
    project,
    tasksByStatus,
    overdue,
    completion: { averageDaysToComplete, completedCount, onTimeRate, overdueCompletionRate },
    workload,
    burndown,
    velocity,
    cumulativeFlow,
    milestones,
    activity,
  };
}

export type UserAnalytics = {
  user: { id: string; name: string | null; email: string | null } | null;
  activeTasks: number;
  completedLast30d: number;
  completedOnTime30d: number;
  completedOverdue30d: number;
  avgCompletionDays: number | null;
  overdueAssigned: number;
  projects: { id: string; name: string }[];
  perProject: { project: { id: string; name: string }; active: number; completedLast30d: number; overdue: number }[];
  timeline30d: { date: string; created: number; completed: number }[];
};

export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  const [user, tasks, memberships] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.task.findMany({ where: { assigneeId: userId } }),
    prisma.projectMember.findMany({ where: { userId }, include: { project: true } }),
  ]);
  const now = new Date();
  const activeTasks = (tasks as TTask[]).filter((t: TTask) => t.status !== "done").length;
  const completedLast30d = (tasks as TTask[]).filter((t: TTask) => t.completedAt && differenceInCalendarDays(now, t.completedAt) <= 30).length;
  const completedOnTime30d = (tasks as TTask[]).filter(
    (t: TTask) => t.completedAt && differenceInCalendarDays(now, t.completedAt) <= 30 && (t.dueDate ? t.completedAt <= t.dueDate : true)
  ).length;
  const completedOverdue30d = Math.max(0, completedLast30d - completedOnTime30d);
  const completedDurations = (tasks as TTask[])
    .filter((t: TTask) => t.status === "done" && t.completedAt)
    .map((t: TTask) => Math.max(0, differenceInCalendarDays(t.completedAt!, t.createdAt)));
  const avgCompletionDays = completedDurations.length
    ? Number((completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length).toFixed(2))
    : null;
  const overdueAssigned = (tasks as TTask[]).filter((t: TTask) => t.status !== "done" && t.dueDate && t.dueDate < now).length;
  const projects = memberships.map((m: any) => ({ id: m.project.id, name: m.project.name }));

  // Per-project breakdown
  const nameByProject: Record<string, string> = Object.fromEntries(projects.map((p: { id: string; name: string }) => [p.id, p.name]));
  const perProjectMap: Record<string, { active: number; completedLast30d: number; overdue: number }> = {};
  for (const t of tasks as TTask[]) {
    const pid = t.projectId;
    if (!perProjectMap[pid]) perProjectMap[pid] = { active: 0, completedLast30d: 0, overdue: 0 };
    if (t.status !== "done") perProjectMap[pid].active += 1;
    if (t.completedAt && differenceInCalendarDays(now, t.completedAt) <= 30) perProjectMap[pid].completedLast30d += 1;
    if (t.status !== "done" && t.dueDate && t.dueDate < now) perProjectMap[pid].overdue += 1;
  }
  const perProject = Object.entries(perProjectMap)
    .map(([projectId, v]) => ({ project: { id: projectId, name: nameByProject[projectId] || projectId }, ...v }))
    .sort((a, b) => b.active - a.active);

  // 30-day timeline for created/completed
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  const timeline30d: { date: string; created: number; completed: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const created = (tasks as TTask[]).filter((t: TTask) => t.createdAt.toISOString().slice(0, 10) === key).length;
    const completed = (tasks as TTask[]).filter((t: TTask) => t.completedAt && t.completedAt.toISOString().slice(0, 10) === key).length;
    timeline30d.push({ date: key, created, completed });
  }

  return {
    user: user ? { id: user.id, name: user.name, email: user.email } : null,
    activeTasks,
    completedLast30d,
    completedOnTime30d,
    completedOverdue30d,
    avgCompletionDays,
    overdueAssigned,
    projects,
    perProject,
    timeline30d,
  };
}

export function detectOverload(workload: { user: { id: string; name: string | null; email: string | null }; count: number }[]) {
  if (!workload.length) return { overloaded: [], mean: 0, stddev: 0 };
  const counts = workload.map((w) => w.count);
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  const variance = counts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / counts.length;
  const stddev = Math.sqrt(variance);
  const threshold = mean + Math.max(2, 1.5) * (stddev || 1);
  const overloaded = workload.filter((w) => w.count > threshold);
  return { overloaded, mean, stddev };
}
