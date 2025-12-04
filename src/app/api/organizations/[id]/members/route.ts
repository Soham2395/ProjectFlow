import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import {
    assertOrgAccess,
    getOrganizationMembers,
    addOrganizationMember,
    updateMemberRole,
    removeMember,
} from "@/lib/org-permissions";
import { prisma } from "@/lib/prisma";

type Params = Promise<{ id: string }>;

// GET /api/organizations/[id]/members - list organization members
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

    const members = await getOrganizationMembers(id);

    return NextResponse.json({ members });
}

// POST /api/organizations/[id]/members - add a member or invite by email
export async function POST(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        // Only admins and owners can add members
        await assertOrgAccess(session.user.id, id, "admin");
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { userId, email, role } = body as {
        userId?: string;
        email?: string;
        role?: string;
    };

    if ((!userId && !email) || !role) {
        return NextResponse.json(
            { error: "Either userId or email, and role are required" },
            { status: 400 }
        );
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    if (!validRoles.includes(role)) {
        return NextResponse.json(
            { error: "Invalid role. Must be one of: owner, admin, member, viewer" },
            { status: 400 }
        );
    }

    // If userId provided, add directly (internal use)
    if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const existing = await prisma.organizationMember.findUnique({
            where: { userId_organizationId: { userId, organizationId: id } },
        });
        if (existing) return NextResponse.json({ error: "User is already a member" }, { status: 400 });

        try {
            const member = await addOrganizationMember(id, userId, role as any);
            return NextResponse.json({ member }, { status: 201 });
        } catch (error: any) {
            return NextResponse.json({ error: error.message || "Failed to add member" }, { status: 500 });
        }
    }

    // If email provided, check if user exists or create invitation
    if (email) {
        const normalizedEmail = email.toLowerCase().trim();

        // 1. Check if user exists
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

        if (existingUser) {
            // User exists, check membership
            const existingMember = await prisma.organizationMember.findUnique({
                where: { userId_organizationId: { userId: existingUser.id, organizationId: id } },
            });

            if (existingMember) {
                return NextResponse.json({ error: "User is already a member" }, { status: 400 });
            }

            // Add directly
            try {
                const member = await addOrganizationMember(id, existingUser.id, role as any);
                return NextResponse.json({ member, message: "User added directly" }, { status: 201 });
            } catch (error: any) {
                return NextResponse.json({ error: error.message || "Failed to add member" }, { status: 500 });
            }
        } else {
            // 2. User does not exist, create invitation
            // Check for existing pending invitation
            const existingInvite = await prisma.invitation.findFirst({
                where: { email: normalizedEmail, organizationId: id, status: "pending" },
            });

            if (existingInvite) {
                return NextResponse.json({ error: "Invitation already sent to this email" }, { status: 400 });
            }

            try {
                const crypto = require('crypto');
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date();
                expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

                const invitation = await prisma.invitation.create({
                    data: {
                        email: normalizedEmail,
                        organizationId: id,
                        role,
                        token,
                        invitedBy: session.user.id,
                        expiresAt,
                    },
                });

                // In a real app, send email here
                console.log(`[INVITE] Created invitation for ${normalizedEmail} to org ${id} with token ${token}`);

                return NextResponse.json({ invitation, message: "Invitation sent" }, { status: 201 });
            } catch (error: any) {
                console.error("Failed to create invitation:", error);
                return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
            }
        }
    }
}

// PATCH /api/organizations/[id]/members - update a member's role
export async function PATCH(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const { userId, role } = body as {
        userId?: string;
        role?: string;
    };

    if (!userId || !role) {
        return NextResponse.json(
            { error: "userId and role are required" },
            { status: 400 }
        );
    }

    const validRoles = ["owner", "admin", "member", "viewer"];
    if (!validRoles.includes(role)) {
        return NextResponse.json(
            { error: "Invalid role. Must be one of: owner, admin, member, viewer" },
            { status: 400 }
        );
    }

    try {
        const member = await updateMemberRole(
            session.user.id,
            id,
            userId,
            role as any
        );

        return NextResponse.json({ member });
    } catch (error: any) {
        console.error("[organizations/members] Failed to update role:", error);
        return NextResponse.json({ error: error.message }, { status: 403 });
    }
}

// DELETE /api/organizations/[id]/members?userId=xxx - remove a member
export async function DELETE(req: Request, { params }: { params: Params }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    try {
        await removeMember(session.user.id, id, userId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[organizations/members] Failed to remove:", error);
        return NextResponse.json({ error: error.message }, { status: 403 });
    }
}
