import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";

export default async function ProjectActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/activity/project/${projectId}`, {
    next: { revalidate: 30 }, // Cache for 30 seconds
    headers: { "cookie": "" },
  }).catch(() => null);
  const data = res && res.ok ? await res.json() : { activity: [] };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">Project Activity</h1>
      <div className="space-y-6">
        {(data.activity || []).map((group: any) => (
          <div key={group.date}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.date}</div>
            <div className="space-y-3">
              {group.entries.map((a: any) => (
                <div key={a.id} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</div>
                  <div className="font-medium">{a.summary}</div>
                  {a.actor && (
                    <div className="text-xs text-muted-foreground">by {a.actor.name || a.actor.email || a.actor.id}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {(!data.activity || data.activity.length === 0) && (
          <div className="rounded border p-6 text-sm text-muted-foreground">No recent activity</div>
        )}
      </div>
    </main>
  );
}
