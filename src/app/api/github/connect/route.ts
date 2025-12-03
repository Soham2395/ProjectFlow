import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOctokitForUser } from "@/lib/github";
import { createActivity } from "@/lib/notifications";

// POST /api/github/connect
// Body: { projectId: string, repoOwner: string, repoName: string, repoUrl?: string }
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, repoOwner, repoName, repoUrl } = await request.json();
    if (!projectId || !repoOwner || !repoName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Ensure user is the project owner; if ownerId is null (legacy), allow admins as fallback
    const projectRecord = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: { select: { userId: true, role: true } } },
    });
    if (!projectRecord) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const isOwner = projectRecord.ownerId
      ? projectRecord.ownerId === session.user.id
      : projectRecord.members.some((m: { userId: string; role?: string }) => m.userId === session.user.id && (m as any).role === "admin");
    if (!isOwner) return NextResponse.json({ error: "Only the project owner can connect a repository" }, { status: 403 });

    // Verify the user has access to the repo (owner or collaborator)
    const octokit = await getOctokitForUser(session.user.id);
    if (!octokit) {
      return NextResponse.json({ error: "GitHub not connected for user" }, { status: 400 });
    }

    try {
      const repo = await octokit.rest.repos.get({ owner: repoOwner, repo: repoName });
      // If not owner, ensure they have push or admin permissions
      const perms = (repo.data as any).permissions;
      if (!perms?.admin && !perms?.push) {
        return NextResponse.json({ error: "You do not have sufficient permissions on this repo" }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Repository not found or inaccessible" }, { status: 404 });
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        repoOwner,
        repoName,
        repoUrl: repoUrl ?? `https://github.com/${repoOwner}/${repoName}`,
        githubIntegrationEnabled: true,
      },
    });

    // Emit activity entry for linking repository
    try {
      await createActivity({
        projectId,
        actorId: session.user.id,
        verb: "linked_repo",
        targetId: null,
        summary: `Linked GitHub repo ${repoOwner}/${repoName}`,
        meta: { repoOwner, repoName, repoUrl: project.repoUrl },
      });
    } catch { }

    return NextResponse.json({ success: true, project });
  } catch (e: any) {
    console.error("[github.connect]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
