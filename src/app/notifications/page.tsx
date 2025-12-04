import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { redirect } from "next/navigation";
import { headers, cookies } from "next/headers";

export default async function NotificationsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const sp = (await searchParams) || {};
  const status = typeof sp.status === 'string' ? sp.status : 'all';
  const projectId = typeof sp.projectId === 'string' ? sp.projectId : '';
  const cursor = typeof sp.cursor === 'string' ? sp.cursor : '';

  const qs = new URLSearchParams();
  qs.set('status', status || 'all');
  if (projectId) qs.set('projectId', projectId);
  const limit = 20;
  qs.set('limit', String(limit));
  if (cursor) qs.set('cursor', cursor);

  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : "";

  const cookieStore = await cookies();
  const res = await fetch(`${origin}/api/notifications?${qs.toString()}`, {
    next: { revalidate: 10 }, // Cache for 10 seconds
    headers: { cookie: cookieStore.toString() },
  });
  const data = res && res.ok ? await res.json() : { notifications: [], unread: 0, nextCursor: null };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">Notifications</h1>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Unread: {data.unread ?? 0}</span>
        <div className="ml-auto flex items-center gap-2">
          <a href={`/notifications?status=all${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`} className={`rounded-md border px-2 py-1 text-xs ${status === 'all' ? 'bg-accent' : ''}`}>All</a>
          <a href={`/notifications?status=unread${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}`} className={`rounded-md border px-2 py-1 text-xs ${status === 'unread' ? 'bg-accent' : ''}`}>Unread</a>
          <form className="flex items-center gap-2" action="/notifications" method="get">
            <input type="hidden" name="status" value={status} />
            <input
              name="projectId"
              placeholder="Filter by projectId"
              defaultValue={projectId}
              className="h-8 w-48 rounded-md border bg-background px-2 text-xs"
            />
            <button className="h-8 rounded-md border px-2 text-xs">Apply</button>
          </form>
        </div>
      </div>
      <div className="space-y-3">
        {(data.notifications || []).map((n: any) => {
          const type = String(n.type || "");
          const payload = n.payload || {};
          const createdAt = new Date(n.createdAt);
          const projectHref = n.projectId ? `/project/${n.projectId}` : undefined;

          // Derive UI fields by type
          let title = "Notification";
          let subtitle: string | null = null;
          let ctaLabel: string | null = null;
          let ctaHref: string | undefined;

          if (type === "task_assigned") {
            title = `Task assigned: ${payload.title ?? "(untitled)"}`;
            subtitle = payload.taskId ? `Task ID: ${payload.taskId}` : null;
            ctaLabel = projectHref ? "Open project" : null;
            ctaHref = projectHref;
          } else if (type === "invitation") {
            title = `Project invitation: ${payload.projectName ?? "Project"}`;
            subtitle = payload.invitedBy ? `Invited by: ${payload.invitedBy}` : null;
            ctaLabel = payload.acceptUrl ? "Accept" : projectHref ? "Open project" : null;
            ctaHref = payload.acceptUrl || projectHref;
          } else if (type === "ai_update") {
            const kind = payload.kind ?? "AI update";
            title = typeof payload.title === 'string' ? `${kind}: ${payload.title}` : String(kind);
            subtitle = payload.taskId ? `Task ID: ${payload.taskId}` : null;
            ctaLabel = projectHref ? "Open project" : null;
            ctaHref = projectHref;
          } else if (type === "github_commit") {
            title = `New commit: ${payload.message ?? "(no message)"}`;
            subtitle = payload.sha ? `SHA: ${payload.sha}` : null;
            ctaLabel = payload.htmlUrl ? "View on GitHub" : projectHref ? "Open project" : null;
            ctaHref = payload.htmlUrl || projectHref;
          } else if (type === "comment" || type === "mention") {
            title = type === "mention" ? "You were mentioned" : "New comment";
            subtitle = payload.preview ? String(payload.preview) : null;
            ctaLabel = projectHref ? "Open project" : null;
            ctaHref = projectHref;
          } else {
            title = type.replace(/_/g, " ") || "Notification";
            subtitle = payload?.title ? String(payload.title) : null;
            ctaLabel = projectHref ? "Open project" : null;
            ctaHref = projectHref;
          }

          return (
            <div key={n.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">{createdAt.toLocaleString()}</div>
                <div className="mt-0.5 font-medium truncate">{title}</div>
                {subtitle ? (
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>
                ) : null}
              </div>
              <div className="shrink-0">
                {ctaLabel && ctaHref ? (
                  <a
                    href={ctaHref}
                    className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    {ctaLabel}
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
        {(!data.notifications || data.notifications.length === 0) && (
          <div className="rounded border p-6 text-sm text-muted-foreground">No notifications</div>
        )}
      </div>
      {data.nextCursor ? (
        <div className="mt-6 flex justify-center">
          <a
            className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
            href={`/notifications?status=${encodeURIComponent(status)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ''}&cursor=${encodeURIComponent(data.nextCursor)}`}
          >
            Load more
          </a>
        </div>
      ) : null}
      <form
        action={async () => {
          "use server";
          const hdrs = await headers();
          const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
          const proto = hdrs.get("x-forwarded-proto") ?? "http";
          const origin = host ? `${proto}://${host}` : "";
          const cookieStore = await cookies();
          await fetch(`${origin}/api/notifications/mark-read`, { method: "POST", headers: { cookie: cookieStore.toString() } });
        }}
      >
        <button className="mt-6 rounded-md border px-3 py-2 text-sm hover:bg-accent">Mark all as read</button>
      </form>
    </main>
  );
}
