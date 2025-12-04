import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { assertOrgAccess, getOrganizationRole, isOrgOwner } from "@/lib/org-permissions";

type Params = Promise<{ id: string }>;

// GET /api/organizations/[id] - get organization details
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

    const organization = await prisma.organization.findUnique({
        where: { id },
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
                orderBy: [{ role: "desc" }, { createdAt: "asc" }],
            },
            workspaces: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    createdAt: true,
                },
            },
            _count: {
                select: {
                    projects: true,
                    members: true,
                },
            },
        },
    });

    if (!organization) {
        return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Get user's role
    const userRole = await getOrganizationRole(session.user.id, id);

    return NextResponse.json({
        organization: {
            ...organization,
            userRole,
        },
    });
}

// PATCH /api/organizations/[id] - update organization settings
export async function PATCH(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        // Only owners and admins can update organization
        await assertOrgAccess(session.user.id, id, "admin");
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, slug, settings } = body as {
        name?: string;
        slug?: string;
        settings?: any;
    };

    const updateData: any = {};

    if (name !== undefined) {
        if (!name.trim()) {
            return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        }
        updateData.name = name.trim();
    }

    if (slug !== undefined) {
        const slugPattern = /^[a-z0-9-]+$/;
        if (!slugPattern.test(slug)) {
            return NextResponse.json(
                { error: "Slug can only contain lowercase letters, numbers, and hyphens" },
                { status: 400 }
            );
        }

        // Check if slug is already taken by another organization
        const existing = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existing && existing.id !== id) {
            return NextResponse.json({ error: "Slug is already taken" }, { status: 400 });
        }

        updateData.slug = slug.trim();
    }

    if (settings !== undefined) {
        updateData.settings = settings;
    }

    if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    try {
        const organization = await prisma.organization.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ organization });
    } catch (error: any) {
        console.error("[organizations] Failed to update:", error);
        return NextResponse.json(
            { error: "Failed to update organization" },
            { status: 500 }
        );
    }
}

// DELETE /api/organizations/[id] - delete organization
export async function DELETE(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Only owners can delete organization
    const isOwner = await isOrgOwner(session.user.id, id);
    if (!isOwner) {
        return NextResponse.json(
            { error: "Only organization owners can delete the organization" },
            { status: 403 }
        );
    }

    try {
        await prisma.organization.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[organizations] Failed to delete:", error);
        return NextResponse.json(
            { error: "Failed to delete organization" },
            { status: 500 }
        );
    }
}
