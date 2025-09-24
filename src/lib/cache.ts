const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function enabled() {
  return Boolean(URL && TOKEN);
}

async function upstashFetch<T = any>(body: any): Promise<T | null> {
  if (!enabled()) return null;
  const res = await fetch(URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  return data;
}

export async function cacheGet(key: string): Promise<any | null> {
  const data = (await upstashFetch({
    // Upstash Redis REST pipeline style
    // Single command: GET key
    // Ref: https://upstash.com/docs/redis/features/restapi
    // For simplicity using single-command API
    // But the REST api expects array of commands, using /pipeline isn't necessary anymore
  })) as any;
  // Fallback to single-command endpoint
  if (!enabled()) return null;
  const res = await fetch(`${URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.result ?? null;
}

export async function cacheSet(key: string, value: any, ttlSeconds = 60): Promise<boolean> {
  if (!enabled()) return false;
  const val = typeof value === "string" ? value : JSON.stringify(value);
  const res = await fetch(`${URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) return false;
  // Set TTL separately to avoid encoding issues in path
  await fetch(`${URL}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  return true;
}
