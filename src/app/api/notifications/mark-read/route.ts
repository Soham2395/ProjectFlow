import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { markNotificationsRead } from "@/lib/notifications";

// POST /api/notifications/mark-read
// body: { ids?: string[]; projectId?: string }
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? (body.ids as string[]) : undefined;
    const projectId = typeof body?.projectId === 'string' ? (body.projectId as string) : undefined;

    const count = await markNotificationsRead({ userId: session.user.id, ids, projectId });
    return NextResponse.json({ updated: count });
  } catch (e) {
    console.error("[notifications.markRead]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
