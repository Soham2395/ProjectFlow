import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessWorkspace } from "@/lib/org-permissions";

type Params = Promise<{ id: string }>;

// GET /api/workspaces/[id] - get workspace details
export async function GET(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const hasAccess = await canAccessWorkspace(session.user.id, id);
    if (!hasAccess) {
        return NextResponse.json(
            { error: "You don't have access to this workspace" },
            { status: 403 }
        );
    }

    const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: {
            organization: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
            projects: {
                include: {
                    members: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    image: true,
                                },
                            },
                        },
                    },
                    _count: {
                        select: {
                            tasks: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
            },
        },
    });

    if (!workspace) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ workspace });
}

// PATCH /api/workspaces/[id] - update workspace
export async function PATCH(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const hasAccess = await canAccessWorkspace(session.user.id, id);
    if (!hasAccess) {
        return NextResponse.json(
            { error: "You don't have access to this workspace" },
            { status: 403 }
        );
    }

    const body = await req.json().catch(() => ({}));
    const { name, description } = body as {
        name?: string;
        description?: string | null;
    };

    const updateData: any = {};

    if (name !== undefined) {
        if (!name.trim()) {
            return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        }
        updateData.name = name.trim();
    }

    if (description !== undefined) {
        updateData.description = description?.trim() || null;
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    try {
        const workspace = await prisma.workspace.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ workspace });
    } catch (error: any) {
        console.error("[workspaces] Failed to update:", error);
        return NextResponse.json(
            { error: "Failed to update workspace" },
            { status: 500 }
        );
    }
}

// DELETE /api/workspaces/[id] - delete workspace
export async function DELETE(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const hasAccess = await canAccessWorkspace(session.user.id, id);
    if (!hasAccess) {
        return NextResponse.json(
            { error: "You don't have access to this workspace" },
            { status: 403 }
        );
    }

    try {
        await prisma.workspace.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[workspaces] Failed to delete:", error);
        return NextResponse.json(
            { error: "Failed to delete workspace" },
            { status: 500 }
        );
    }
}
