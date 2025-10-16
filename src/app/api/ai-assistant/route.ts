import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  getProjectStatus,
  getOverdueTasks,
  getWorkloadDistribution,
  getRecentCommits,
  getRecentChats,
  createTaskNL,
  updateTaskNL,
} from "@/lib/assistant";
import { cacheGet, cacheSet } from "@/lib/cache";
import { openaiJson } from "@/lib/openai";

type Decision = { action: "getOverdueTasks" | "getProjectStatus" | "getWorkloadDistribution" | "createTask" | "updateTask" | "summarize"; args: any };
type OpenAIOutcome = { decision: Decision | null; used: "openai-tools" | "openai-json" | "fallback" | "disabled" | "error" };

async function callOpenAIForDecision(prompt: string): Promise<OpenAIOutcome> {
  const provider = (process.env.AI_ASSISTANT_PROVIDER || "").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  if (provider !== "openai" || !apiKey) return { decision: null, used: "disabled" };
  const schema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["getOverdueTasks", "getProjectStatus", "getWorkloadDistribution", "createTask", "updateTask", "summarize"],
      },
      args: {
        type: "object",
        properties: {
          // For createTask
          title: { type: "string" },
          description: { type: "string" },
          assignee: { type: "string" },
          deadline: { type: "string" },
          priority: { type: "string" },
          labels: { type: "array", items: { type: "string" } },
          // For updateTask
          id: { type: "string" },
          field: { type: "string" },
          value: { type: ["string", "number", "null"] },
        },
        additionalProperties: true,
      },
    },
    required: ["action", "args"],
    additionalProperties: false,
  } as const;

  try {
    const parsed = await openaiJson<Decision>({
      system:
        "Classify a project prompt into a JSON object matching {action, args}. Allowed actions: getProjectStatus, getOverdueTasks, getWorkloadDistribution, createTask, updateTask, summarize. For createTask include title, description, assignee, deadline, priority, labels[]. For updateTask include id (string without #), field (status|priority|assigneeId|title|description|dueDate|labels) and value.",
      user: prompt,
      temperature: 0,
      schema: schema as any,
    });
    if (parsed?.action) return { decision: parsed as Decision, used: "openai-json" };
  } catch (e) {
    console.error("OpenAI decision error", e);
  }
  return { decision: null, used: "error" };
}

function extractTitleFromPrompt(prompt: string, args: any): string | null {
  // Prefer title provided by OpenAI args
  if (args?.title && String(args.title).trim()) return String(args.title).trim();
  const p = prompt.trim();
  // Common phrasing variants
  const patterns: RegExp[] = [
    /create\s+(?:a\s+)?(?:new\s+)?task(?:\s+(?:called|named))?\s+["“]?([^"”\n]+)["”]?/i,
    /add\s+(?:a\s+)?task(?:\s+(?:called|named))?\s+["“]?([^"”\n]+)["”]?/i,
    /with\s+(?:the\s+)?title\s+(?:is|as|=)\s*["“]?([^"”\n]+)["”]?/i,
    /title\s+(?:is|as|=)\s*["“]?([^"”\n]+)["”]?/i,
    /titled\s+["“]?([^"”\n]+)["”]?/i,
  ];
  for (const r of patterns) {
    const m = p.match(r);
    if (m?.[1]) return m[1].trim();
  }
  // As a last resort, if there's a quoted phrase and the intent is create
  if (/\bcreate\b|\badd\b/i.test(p)) {
    const q = p.match(/["“]([^"”\n]+)["”]/);
    if (q?.[1]) return q[1].trim();
  }
  return null;
}

function fallbackDecision(prompt: string): Decision {
  const p = prompt.toLowerCase();
  if (p.includes("overdue")) return { action: "getOverdueTasks", args: {} };
  if (p.includes("status") || p.includes("what's the status") || p.includes("project status")) return { action: "getProjectStatus", args: {} };
  if (p.includes("overloaded") || p.includes("workload")) return { action: "getWorkloadDistribution", args: {} };
  // create task variants
  if (
    p.startsWith("add a task") ||
    p.startsWith("create task") ||
    p.startsWith("create a task") ||
    p.startsWith("create a new task") ||
    p.includes("add task") ||
    p.includes("add a new task") ||
    p.includes("new task") ||
    p.startsWith("make a task")
  ) {
    return { action: "createTask", args: {} };
  }
  // update/move variants
  if (
    p.startsWith("move") ||
    p.includes("update task") ||
    p.includes("change status") ||
    p.includes("set status") ||
    p.includes("set priority") ||
    p.includes("assign task") ||
    p.startsWith("assign ") ||
    p.includes("assign ") ||
    p.includes("set assignee")
  ) {
    return { action: "updateTask", args: {} };
  }
  if (p.includes("summarize") || p.includes("summary")) return { action: "summarize", args: {} };
  return { action: "summarize", args: {} };
}

async function resolveMemberId(projectId: string, identifier?: string | null, currentUserId?: string | null): Promise<string | null> {
  if (!identifier) return null;
  const ident = identifier.trim();
  // Special cases: me/myself
  if (currentUserId && /^(me|myself)$/i.test(ident)) return currentUserId;
  // If looks like an ID, return as-is
  if (/^[a-z0-9-]{8,}$/i.test(ident)) return ident;
  // Try by exact email
  const byEmail = await prisma.user.findFirst({ where: { email: ident } });
  if (byEmail) {
    const mem = await prisma.projectMember.findFirst({ where: { projectId, userId: byEmail.id } });
    if (mem) return byEmail.id;
  }
  // Try by name (case-insensitive contains)
  const candidates = await prisma.user.findMany({ where: { name: { contains: ident, mode: "insensitive" } }, take: 5 });
  for (const u of candidates) {
    const mem = await prisma.projectMember.findFirst({ where: { projectId, userId: u.id } });
    if (mem) return u.id;
  }
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { projectId, prompt } = body as { projectId?: string; prompt?: string };
  if (!projectId || !prompt?.trim()) return NextResponse.json({ error: "projectId and prompt required" }, { status: 400 });

  let isMember = null as any;
  const DEBUG = process.env.AI_ASSISTANT_DEBUG === "true";
  try {
    isMember = await prisma.projectMember.findFirst({ where: { projectId, userId: session.user.id } });
  } catch (e: any) {
    if (DEBUG) console.error("[AI-ASSISTANT] DB error on membership check", e);
    return NextResponse.json(
      { error: "Service temporarily unavailable (database connection). Please try again.", code: "DB_UNAVAILABLE" },
      { status: 503 }
    );
  }
  if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Decide action via OpenAI (if configured) or fallback
  const ai = await callOpenAIForDecision(prompt);
  const decision = ai.decision || fallbackDecision(prompt);
  if (DEBUG) {
    console.log("[AI-ASSISTANT] decision", {
      provider: (process.env.AI_ASSISTANT_PROVIDER || '').toLowerCase() || 'none',
      used: ai.used,
      model: process.env.OPENAI_MODEL || null,
      action: decision.action,
      // do not log full prompt in prod, but okay behind debug flag
      prompt,
    });
  }

  // Caching for frequent queries
  const cacheable = new Set(["getProjectStatus", "getOverdueTasks", "getWorkloadDistribution"]);
  const maybeCacheKey = cacheable.has(decision.action) ? `aiassist:${decision.action}:${projectId}` : null;

  let status = null as Awaited<ReturnType<typeof getProjectStatus>> | null;
  let overdue = null as Awaited<ReturnType<typeof getOverdueTasks>> | null;
  let workload = null as Awaited<ReturnType<typeof getWorkloadDistribution>> | null;
  let commits = null as Awaited<ReturnType<typeof getRecentCommits>> | null;
  let chats = null as Awaited<ReturnType<typeof getRecentChats>> | null;

  if (maybeCacheKey) {
    const cached = await cacheGet(maybeCacheKey);
    if (cached) {
      // Return directly from cache when possible
      return NextResponse.json(cached);
    }
  }

  // Fetch base context (lazy where needed)
  if (decision.action === "getProjectStatus" || decision.action === "summarize") {
    status = await getProjectStatus({ projectId });
  }
  if (decision.action === "getOverdueTasks" || decision.action === "summarize") {
    overdue = await getOverdueTasks({ projectId });
  }
  if (decision.action === "getWorkloadDistribution" || decision.action === "summarize") {
    workload = await getWorkloadDistribution({ projectId });
  }
  if (decision.action === "summarize") {
    [commits, chats] = await Promise.all([
      getRecentCommits({ projectId, limit: 20 }),
      getRecentChats({ projectId, limit: 50 }),
    ]);
  }

  let result: any = null;
  let message = "";

  if (decision.action === "getOverdueTasks") {
    result = overdue;
    const count = overdue?.length || 0;
    message = count ? `Found ${count} overdue tasks.` : "No overdue tasks.";
  } else if (decision.action === "getProjectStatus") {
    result = status;
    if (status) message = `Project ${status.project?.name}: ${status.tasks.done}/${status.tasks.total} done, ${status.tasks.inProgress} in progress, ${status.tasks.todo} todo, ${status.tasks.overdue} overdue.`;
  } else if (decision.action === "getWorkloadDistribution") {
    result = workload;
    const top = workload && workload[0];
    message = top ? `${top.user.name || top.user.email || top.user.id} has the highest workload score (${top.workloadScore}).` : "No workload data.";
  } else if (decision.action === "createTask") {
    try {
      // Use extracted args from OpenAI if available, otherwise naive fallback
      const args = decision.args || {};
      // Robust title extraction supporting many phrasings, e.g. "with the title as test"
      const extracted = extractTitleFromPrompt(prompt, args);
      const m = prompt.match(/add a task(?: to)?\s*(.*)/i) || prompt.match(/create task\s*(.*)/i);
      const title = extracted || m?.[1]?.trim();
      
      if (!title) {
        throw new Error("Please provide a title for the task.");
      }
      
      const assigneeId = await resolveMemberId(projectId, args.assignee, session.user.id);
      if (DEBUG) {
        console.log("[AI-ASSISTANT] createTask parsed", {
          title,
          assigneeInput: args.assignee || null,
          assigneeId,
          priority: args.priority || null,
          deadline: args.deadline || null,
        });
      }
      const task = await createTaskNL({
        projectId,
        title,
        description: args.description || null,
        assignee: assigneeId,
        deadline: args.deadline || null,
        priority: args.priority || null,
        labels: Array.isArray(args.labels) ? (args.labels as string[]) : undefined,
      });
      
      if (!task) {
        throw new Error("Failed to create the task. Please try again.");
      }
      
      result = task;
      message = `✅ Task created successfully: ${task.title}`;
      
      // Invalidate relevant caches
      const cacheKeys = [
        `aiassist:getProjectStatus:${projectId}`,
        `aiassist:getOverdueTasks:${projectId}`,
        `aiassist:getWorkloadDistribution:${projectId}`
      ];
      
      // Don't await these to return response faster
      Promise.allSettled(cacheKeys.map(key => cacheSet(key, null, 1)));
      
    } catch (error) {
      console.error("Error creating task:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create task";
      return NextResponse.json({ 
        error: errorMessage,
        message: `❌ ${errorMessage}`,
        action: "createTask",
        success: false
      }, { status: 400 });
    }
  } else if (decision.action === "updateTask") {
    try {
    const args = decision.args || {};
    // First, detect patterns like: "assign <id> to <who>" or "set assignee of <id> to <who>"
    const mAssignIdTo =
      prompt.match(/assign\s+(?:task\s+)?#?([a-z0-9-]{6,})\s+to\s+(@?[\w.-]+@[^\s]+|[a-z][\w\s.-]+)/i) ||
      prompt.match(/set\s+assignee\s+(?:of|for)\s+(?:task\s+)?#?([a-z0-9-]{6,})\s+to\s+(@?[\w.-]+@[^\s]+|[a-z][\w\s.-]+)/i);
    // Extract ID: support '#<id>', 'task <id>', 'assign <id> to ...', or a bare-looking id token
    let id =
      (args.id as string) ||
      (mAssignIdTo ? mAssignIdTo[1] : undefined) ||
      prompt.match(/task\s+([a-z0-9-]{6,})/i)?.[1] ||
      prompt.match(/#([a-z0-9-]{6,})/i)?.[1] ||
      prompt.match(/id\s*[:#]?\s*([a-z0-9-]{6,})/i)?.[1] ||
      null;
    if (!id) {
      // As a last resort, pick a long id-like token
      const anyId = prompt.match(/\b([a-z0-9-]{12,})\b/i)?.[1];
      if (anyId) id = anyId;
    }
    let field = (args.field as string) || "";
    let value = args.value as any;
    // Parse common phrases if field unspecified
    if (!field) {
      // If we matched assign <id> to <who>, prefer that
      if (mAssignIdTo) {
        field = "assigneeId";
        value = mAssignIdTo[2];
      } else {
        const mStatus = prompt.match(/\bto\s+(todo|in\s*progress|done)\b/i);
        const mPriority = prompt.match(/\b(priority|prio)\s*(to|=)?\s*(low|medium|high|urgent)\b/i);
        // Require explicit 'to' before the target to avoid capturing the ID as the assignee
        const mAssign = prompt.match(/\bassign(ed)?\s+to\s+(@?[\w.-]+@[^\s]+|[a-z][\w\s.-]+)\b/i);
        const mAssignMe = prompt.match(/\bassign(ed)?\s+to\s+(me|myself)\b/i);
        const mUnassign = prompt.match(/\bunassign\b/i);
        if (mStatus) {
          field = "status";
          value = mStatus[1].replace(/\s+/g, "_").toLowerCase();
        } else if (mPriority) {
          field = "priority";
          value = mPriority[3].toLowerCase();
        } else if (mAssign) {
          field = "assigneeId";
          value = mAssign[2];
        } else if (mAssignMe) {
          field = "assigneeId";
          value = "me";
        } else if (mUnassign) {
          field = "assigneeId";
          value = null;
        }
      }
    }
    if (DEBUG) {
      console.log("[AI-ASSISTANT] updateTask parsed", { id, field, valueRaw: value });
    }
    if (!id) {
      message = "Please specify a task ID (e.g., task <id> or #<id>).";
    } else if (!field) {
      message = "Please specify what to change (e.g., move to In Progress, set priority to High, assign to Alice).";
    } else {
      // Verify task exists and belongs to this project
      const existing = await prisma.task.findUnique({ where: { id } });
      if (!existing || existing.projectId !== projectId) {
        return NextResponse.json({ error: "Task not found in this project." }, { status: 404 });
      }
      // Resolve assignee if needed
      if (field === "assigneeId" && typeof value === "string") {
        const resolved = await resolveMemberId(projectId, value, session.user.id);
        if (!resolved) {
          return NextResponse.json({ error: `Could not find a project member matching '${value}'.` }, { status: 400 });
        }
        value = resolved;
        if (DEBUG) {
          console.log("[AI-ASSISTANT] updateTask assignee resolved", { id, assigneeId: value });
        }
      }
      await updateTaskNL({ id, field, value });
      message = `Updated task ${id}.`;
    }
    } catch (err) {
      console.error("updateTask error", err);
      // Provide a more specific message when possible
      const msg = err instanceof Error && /P2025|Record to update not found/i.test(err.message)
        ? "Task not found. Please check the ID and try again."
        : "Failed to update task. Please try again.";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } else {
    // Summarization (can be replaced with OpenAI for nicer prose)
    const overdueCount = overdue?.length || 0;
    const done = status?.tasks.done || 0;
    const total = status?.tasks.total || 0;
    const recentCommits = (commits || []).slice(0, 5).map((c) => `- ${c.message} (${c.author})`).join("\n");
    message = `Status: ${done}/${total} tasks done. Overdue: ${overdueCount}. Recent commits:\n${recentCommits || "No recent commits."}`;
  }

  const payload: any = { message, data: result, context: { commits: commits?.length || 0, chats: chats?.length || 0 } };
  if (DEBUG) {
    payload.debug = {
      provider: (process.env.AI_ASSISTANT_PROVIDER || "").toLowerCase() || "none",
      model: process.env.OPENAI_MODEL || null,
      used: ai.used,
    };
  }
  if (maybeCacheKey) {
    await cacheSet(maybeCacheKey, payload, 45); // 45s TTL cache
  }
  return NextResponse.json(payload);
}
