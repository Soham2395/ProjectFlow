import crypto from "crypto";

// Provider-agnostic AI allocation service with simple in-memory cache and feature flag.
// Minimal payloads are sent to external providers to control costs.

export type AllocationInput = {
  task: {
    id?: string;
    title: string;
    description?: string | null;
    priority: string;
    labels?: { name: string }[];
    dueDate?: Date | string | null;
    projectId: string;
  };
  team: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    skills: string[];
    workloadScore: number; // computed on server
  }>;
};

export type AllocationSuggestion = { userId: string; confidence: number } | null;

const cache = new Map<string, AllocationSuggestion>();

function makeKey(input: AllocationInput): string {
  // Only include minimal fields for cache key
  const obj = {
    task: {
      title: input.task.title,
      priority: input.task.priority,
      labels: (input.task.labels || []).map((l) => l.name).sort(),
      dueDate: input.task.dueDate ? new Date(input.task.dueDate).toISOString().slice(0, 10) : null,
      projectId: input.task.projectId,
    },
    team: input.team
      .map((m) => ({ id: m.id, skills: [...(m.skills || [])].sort(), workloadScore: Math.round(m.workloadScore * 100) / 100 }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  };
  const data = JSON.stringify(obj);
  return crypto.createHash("sha256").update(data).digest("hex");
}

export async function allocateWithAI(input: AllocationInput): Promise<AllocationSuggestion> {
  if (process.env.AI_ALLOCATION_ENABLED !== "true") return null;

  const key = makeKey(input);
  if (cache.has(key)) return cache.get(key)!;

  // If no provider configured, use a deterministic heuristic fallback.
  const provider = (process.env.AI_ALLOCATION_PROVIDER || "heuristic").toLowerCase();

  let suggestion: AllocationSuggestion = null;
  try {
    if (provider === "openai") {
      suggestion = await callOpenAI(input);
    } else if (provider === "gemini") {
      suggestion = await callGemini(input);
    } else {
      suggestion = heuristicSuggest(input);
    }
  } catch (e) {
    // Fall back to heuristic on errors
    console.error("AI provider error; falling back to heuristic", e);
    suggestion = heuristicSuggest(input);
  }

  cache.set(key, suggestion);
  return suggestion;
}

// Very simple heuristic: score each member by skill overlap and lower workload.
function heuristicSuggest(input: AllocationInput): AllocationSuggestion {
  const labelSkills = new Set((input.task.labels || []).map((l) => l.name.toLowerCase()));
  const titleWords = new Set(
    input.task.title
      .toLowerCase()
      .split(/[^a-z0-9+#]+/i)
      .filter((w) => w && w.length > 1)
  );
  const desired = new Set([...labelSkills, ...Array.from(titleWords)]);

  let best: { id: string; score: number } | null = null;
  for (const m of input.team) {
    const skills = new Set((m.skills || []).map((s) => s.toLowerCase()));
    const overlap = [...desired].reduce((acc, s) => (skills.has(s) ? acc + 1 : acc), 0);
    const workloadPenalty = Math.max(0, m.workloadScore);
    const score = overlap + 1 - 0.5 * workloadPenalty; // prefer lower workload; ensure positive base
    if (!best || score > best.score) best = { id: m.id, score };
  }
  if (!best) return null;
  const normalized = Math.min(0.99, Math.max(0.51, 0.6 + (best.score / 10)));
  return { userId: best.id, confidence: Number(normalized.toFixed(2)) };
}

async function callOpenAI(_input: AllocationInput): Promise<AllocationSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  // To keep costs low, we'll use a structured prompt with minimal fields and a small JSON schema via responses API if available.
  // Since not all environments have the SDK, and to avoid adding heavy deps, we demonstrate a lightweight fetch call.
  // NOTE: Replace this with your preferred OpenAI API call. Keep payload minimal.
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini", // cost-effective
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that selects the best assignee for a software task using skills and workload. Return JSON with userId and confidence (0-1).",
        },
        {
          role: "user",
          content: JSON.stringify({
            task: {
              title: _input.task.title,
              priority: _input.task.priority,
              labels: (_input.task.labels || []).map((l) => l.name),
              dueDate: _input.task.dueDate || null,
            },
            team: _input.team.map((m) => ({ id: m.id, skills: m.skills, workloadScore: m.workloadScore })),
          }),
        },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed?.userId) {
      const conf = typeof parsed.confidence === "number" ? parsed.confidence : 0.6;
      return { userId: String(parsed.userId), confidence: conf };
    }
  } catch {
    // ignore
  }
  return null;
}

async function callGemini(_input: AllocationInput): Promise<AllocationSuggestion> {
  // Placeholder for Gemini integration. To avoid extra deps, we just fallback to heuristic for now.
  return heuristicSuggest(_input);
}
