import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOctokitForProject } from "@/lib/github";

// GET /api/github/commits?projectId=...&branch=main&per_page=20
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const branch = searchParams.get("branch") || undefined;
    const perPage = Number(searchParams.get("per_page") || 20);

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const membership = await prisma.projectMember.findFirst({
      where: { userId: session.user.id, projectId },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project || !project.githubIntegrationEnabled || !project.repoOwner || !project.repoName) {
      return NextResponse.json({ error: "GitHub integration not configured" }, { status: 400 });
    }

    const octokit = await getOctokitForProject(projectId, session.user.id);
    if (!octokit) {
      return NextResponse.json({ error: "GitHub not connected for project. Ask an owner/admin to connect their GitHub." }, { status: 400 });
    }

    const commitsResp = await octokit.rest.repos.listCommits({
      owner: project.repoOwner,
      repo: project.repoName,
      sha: branch,
      per_page: Math.min(Math.max(perPage, 1), 100),
    });

    const commits = commitsResp.data.map((c: any) => ({
      sha: c.sha,
      message: c.commit.message,
      authorName: c.commit.author?.name || c.author?.login || null,
      authorAvatar: c.author?.avatar_url || null,
      htmlUrl: c.html_url,
      date: c.commit.author?.date || null,
      branch: branch || "default",
    }));

    return NextResponse.json({ commits });
  } catch (e) {
    console.error("[github.commits]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
