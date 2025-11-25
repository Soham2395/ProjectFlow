import OpenAI from "openai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function openaiJson<T = any>({
  system,
  user,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  schema,
  temperature = 0,
}: {
  system: string;
  user: string;
  model?: string;
  schema?: object;
  temperature?: number;
}): Promise<T | null> {
  const body: any = {
    model,
    temperature,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "Schema", schema, strict: true },
    };
  } else {
    body.response_format = { type: "json_object" };
  }
  const response = await openai.responses.create(body);
  const text = (response as any).output_text as string | undefined;
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function openaiText({
  system,
  user,
  model = process.env.OPENAI_MODEL || "gpt-4o-mini",
  temperature = 0.2,
}: {
  system: string;
  user: string;
  model?: string;
  temperature?: number;
}): Promise<string | null> {
  const body: any = {
    model,
    temperature,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  const response = await openai.responses.create(body);
  return ((response as any).output_text as string | undefined) || null;
}
