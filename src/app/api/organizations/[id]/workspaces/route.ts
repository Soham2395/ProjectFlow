import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertOrgAccess } from "@/lib/org-permissions";

type Params = Promise<{ id: string }>;

// GET /api/organizations/[id]/workspaces - list workspaces in organization
export async function GET(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        await assertOrgAccess(session.user.id, id);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const workspaces = await prisma.workspace.findMany({
        where: { organizationId: id },
        include: {
            _count: {
                select: {
                    projects: true,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ workspaces });
}

// POST /api/organizations/[id]/workspaces - create a workspace
export async function POST(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        // Members and above can create workspaces
        await assertOrgAccess(session.user.id, id, "member");
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, description } = body as {
        name?: string;
        description?: string;
    };

    if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    try {
        const workspace = await prisma.workspace.create({
            data: {
                name: name.trim(),
                description: description?.trim() || null,
                organizationId: id,
            },
            include: {
                _count: {
                    select: {
                        projects: true,
                    },
                },
            },
        });

        return NextResponse.json({ workspace }, { status: 201 });
    } catch (error: any) {
        console.error("[workspaces] Failed to create:", error);
        return NextResponse.json(
            { error: "Failed to create workspace" },
            { status: 500 }
        );
    }
}
