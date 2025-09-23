import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { getOctokitForUser } from "@/lib/github";

// GET /api/github/repos?per_page=50
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const perPage = Number(searchParams.get("per_page") || 50);

    const octokit = await getOctokitForUser(session.user.id);
    if (!octokit) {
      return NextResponse.json({ error: "GitHub not connected for user" }, { status: 400 });
    }

    // List repos the user owns or is a collaborator on
    const reposResp = await octokit.rest.repos.listForAuthenticatedUser({
      per_page: Math.min(Math.max(perPage, 1), 100),
      sort: "updated",
      direction: "desc",
      visibility: "all",
      affiliation: "owner,collaborator,organization_member",
    });

    const repos = reposResp.data.map((r: any) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      private: r.private,
      owner: r.owner?.login,
      htmlUrl: r.html_url,
      defaultBranch: r.default_branch,
      permissions: r.permissions || null,
      pushedAt: r.pushed_at,
    }));

    return NextResponse.json({ repos });
  } catch (e) {
    console.error("[github.repos]", e);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
