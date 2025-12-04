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

type Decision = { action: "getOverdueTasks" | "getProjectStatus" | "getWorkloadDistribution" | "createTask" | "updateTask" | "summarize"; args: any };
type OpenAIOutcome = { decision: Decision | null; used: "openai-tools" | "openai-json" | "fallback" | "disabled" | "error" };

async function callOpenAIForDecision(prompt: string): Promise<OpenAIOutcome> {
  const provider = (process.env.AI_ASSISTANT_PROVIDER || "").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;
  if (provider !== "openai" || !apiKey) return { decision: null, used: "disabled" };
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
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
    // 1) Try OpenAI Tool (function) calling for structured args
    const toolRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        tools: [
          {
            type: "function",
            function: {
              name: "decide",
              description: "Classify prompt into a project assistant action with arguments",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "decide" } },
        messages: [
          { role: "system", content: "Classify a project prompt into {action, args}. Allowed actions: getProjectStatus, getOverdueTasks, getWorkloadDistribution, createTask, updateTask, summarize. args: For createTask include title, description, assignee, deadline, priority, labels[]. For updateTask include id (string without #), field (status|priority|assigneeId|title|description|dueDate|labels) and value." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const toolData = await toolRes.json();
    const tc = toolData?.choices?.[0]?.message?.tool_calls?.[0];
    if (tc?.function?.name === "decide") {
      const args = tc.function.arguments ? JSON.parse(tc.function.arguments) : null;
      if (args?.action) return { decision: args as Decision, used: "openai-tools" };
    }

    // 2) Fallback to JSON mode in case tools are not available for the model
    const jsonRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: "Output strictly a JSON object matching {action, args}. Allowed actions: getProjectStatus, getOverdueTasks, getWorkloadDistribution, createTask, updateTask, summarize. For createTask extract title, description, assignee, deadline, priority, labels[]. For updateTask extract id, field (status|priority|assigneeId|title|description|dueDate|labels), value." },
          { role: "user", content: prompt },
        ],
      }),
    });
    const jsonData = await jsonRes.json();
    const content = jsonData?.choices?.[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      if (parsed?.action) return { decision: parsed as Decision, used: "openai-json" };
    }
  } catch (e) {
    console.error("OpenAI decision error", e);
  }
  return { decision: null, used: "error" };
}

async function generateLLMResponse(params: {
  action: string;
  prompt: string;
  result: any;
  projectName?: string;
  templateFallback: string;
}): Promise<string> {
  const { action, prompt, result, projectName, templateFallback } = params;

  // Check if LLM is enabled
  const provider = (process.env.AI_ASSISTANT_PROVIDER || "").toLowerCase();
  const apiKey = process.env.OPENAI_API_KEY;

  if (provider !== "openai" || !apiKey) {
    return templateFallback;
  }

  const model = process.env.AI_ASSISTANT_RESPONSE_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const maxTokens = parseInt(process.env.AI_ASSISTANT_MAX_TOKENS || "500", 10);

  try {
    // Format context based on action type
    let context = "";

    if (action === "getProjectStatus" && result) {
      context = `Project: ${projectName || "Unknown"}
Tasks: ${result.tasks.total} total (${result.tasks.done} done, ${result.tasks.inProgress} in progress, ${result.tasks.todo} todo, ${result.tasks.overdue} overdue)`;
    } else if (action === "getOverdueTasks" && Array.isArray(result)) {
      context = `Found ${result.length} overdue tasks:\n${result.map((t: any) =>
        `- "${t.title}" (ID: ${t.id}, assigned to: ${t.assignee?.name || t.assignee?.email || "unassigned"}, due: ${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "N/A"})`
      ).join("\n")}`;
    } else if (action === "getWorkloadDistribution" && Array.isArray(result)) {
      context = `Workload distribution:\n${result.slice(0, 5).map((w: any) =>
        `- ${w.user.name || w.user.email}: ${w.taskCount} tasks (workload score: ${w.workloadScore})`
      ).join("\n")}`;
    } else if (action === "createTask" && result) {
      context = `Successfully created task:
Title: ${result.title}
ID: ${result.id}
Status: ${result.status}
Priority: ${result.priority}
Assigned to: ${result.assignee?.name || result.assignee?.email || "unassigned"}`;
    } else if (action === "updateTask") {
      context = `Task update completed successfully.`;
    } else if (action === "summarize") {
      context = `Project summary data available.`;
    }

    const systemPrompt = `You are a helpful project management assistant. Respond to the user's query in a natural, conversational way.

Guidelines:
- Be concise but informative
- Use a friendly, professional tone
- Highlight important information (overdue tasks, blockers, etc.)
- Offer helpful suggestions when appropriate
- Keep responses under 3-4 sentences unless summarizing
- Use emojis sparingly and appropriately (✅ for success, ⚠️ for warnings, etc.)

Context about what just happened:
${context}

User's original request: "${prompt}"

Provide a natural, helpful response based on this context.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[AI-ASSISTANT] LLM response generation failed:", response.status);
      return templateFallback;
    }

    const data = await response.json();
    const generatedResponse = data?.choices?.[0]?.message?.content?.trim();

    if (generatedResponse) {
      return generatedResponse;
    }

    return templateFallback;
  } catch (error) {
    console.error("[AI-ASSISTANT] Error generating LLM response:", error);
    return templateFallback;
  }
}

function extractTitleFromPrompt(prompt: string, args: any): string | null {
  // Prefer title provided by OpenAI args
  if (args?.title && String(args.title).trim()) return String(args.title).trim();
  const p = prompt.trim();
  // Common phrasing variants - stop at 'with' to avoid capturing priority/metadata
  const patterns: RegExp[] = [
    // "Create a task called 'Fix bug' with high priority" -> "Fix bug"
    /create\s+(?:a\s+)?(?:new\s+)?task(?:\s+(?:called|named))?\s+['"]([^'"]+)['"]/i,
    /create\s+(?:a\s+)?(?:new\s+)?task(?:\s+(?:called|named))?\s+([^'"]+?)(?:\s+with|\s+assigned|\s+due|\s+priority|$)/i,

    // "Add a task 'Fix bug' with..." -> "Fix bug"
    /add\s+(?:a\s+)?task(?:\s+(?:called|named))?\s+['"]([^'"]+)['"]/i,
    /add\s+(?:a\s+)?task(?:\s+(?:called|named))?\s+([^'"]+?)(?:\s+with|\s+assigned|\s+due|\s+priority|$)/i,

    // "with the title as 'Fix bug'" -> "Fix bug"
    /with\s+(?:the\s+)?title\s+(?:is|as|=)\s*['"]([^'"]+)['"]/i,
    /title\s+(?:is|as|=)\s*['"]([^'"]+)['"]/i,
    /titled\s+['"]([^'"]+)['"]/i,
  ];

  for (const r of patterns) {
    const m = p.match(r);
    if (m?.[1]) {
      const title = m[1].trim();
      // Additional cleanup: remove trailing 'with', 'assigned', etc.
      return title.replace(/\s+(with|assigned|due|priority).*$/i, '').trim();
    }
  }

  // As a last resort, if there's a quoted phrase and the intent is create
  if (/\bcreate\b|\badd\b/i.test(p)) {
    const q = p.match(/['"]([^'"]+)['"]/);
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
    const templateFallback = count ? `Found ${count} overdue tasks.` : "No overdue tasks.";
    message = await generateLLMResponse({
      action: "getOverdueTasks",
      prompt,
      result: overdue,
      templateFallback,
    });
  } else if (decision.action === "getProjectStatus") {
    result = status;
    const templateFallback = status ? `Project ${status.project?.name}: ${status.tasks.done}/${status.tasks.total} done, ${status.tasks.inProgress} in progress, ${status.tasks.todo} todo, ${status.tasks.overdue} overdue.` : "No status available.";
    message = await generateLLMResponse({
      action: "getProjectStatus",
      prompt,
      result: status,
      projectName: status?.project?.name,
      templateFallback,
    });
  } else if (decision.action === "getWorkloadDistribution") {
    result = workload;
    const top = workload && workload[0];
    const templateFallback = top ? `${top.user.name || top.user.email || top.user.id} has the highest workload score (${top.workloadScore}).` : "No workload data.";
    message = await generateLLMResponse({
      action: "getWorkloadDistribution",
      prompt,
      result: workload,
      templateFallback,
    });
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
      const templateFallback = `✅ Task created successfully: ${task.title}`;
      message = await generateLLMResponse({
        action: "createTask",
        prompt,
        result: task,
        templateFallback,
      });

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
        const updatedTask = await updateTaskNL({ id, field, value });
        result = updatedTask;
        const templateFallback = `Updated task ${id}.`;
        message = await generateLLMResponse({
          action: "updateTask",
          prompt,
          result: updatedTask,
          templateFallback,
        });
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
    // Summarization with LLM
    const overdueCount = overdue?.length || 0;
    const done = status?.tasks.done || 0;
    const total = status?.tasks.total || 0;
    const recentCommits = (commits || []).slice(0, 5).map((c) => `- ${c.message} (${c.author})`).join("\n");
    const templateFallback = `Status: ${done}/${total} tasks done. Overdue: ${overdueCount}. Recent commits:\n${recentCommits || "No recent commits."}`;

    result = { status, overdue, workload, commits: commits?.slice(0, 5), chats: chats?.slice(0, 10) };
    message = await generateLLMResponse({
      action: "summarize",
      prompt,
      result,
      projectName: status?.project?.name,
      templateFallback,
    });
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
