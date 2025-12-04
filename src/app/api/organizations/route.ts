import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createOrganization, getUserOrganizations } from "@/lib/org-permissions";

// GET /api/organizations - list all organizations the user belongs to
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizations = await getUserOrganizations(session.user.id);

    return NextResponse.json({ organizations });
}

// POST /api/organizations - create a new organization
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user exists in database (handles stale JWT sessions after DB reset)
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
        return NextResponse.json({ error: "User record not found. Please sign out and sign in again." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, slug, settings } = body as {
        name?: string;
        slug?: string;
        settings?: any;
    };

    if (!name || name.trim().length === 0) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Validate slug if provided
    if (slug) {
        const slugPattern = /^[a-z0-9-]+$/;
        if (!slugPattern.test(slug)) {
            return NextResponse.json(
                { error: "Slug can only contain lowercase letters, numbers, and hyphens" },
                { status: 400 }
            );
        }

        // Check if slug is already taken
        const existing = await prisma.organization.findUnique({
            where: { slug },
        });

        if (existing) {
            return NextResponse.json({ error: "Slug is already taken" }, { status: 400 });
        }
    }

    try {
        const organization = await createOrganization(
            session.user.id,
            name.trim(),
            slug?.trim(),
            settings
        );

        return NextResponse.json({ organization }, { status: 201 });
    } catch (error: any) {
        console.error("[organizations] Failed to create:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create organization" },
            { status: 500 }
        );
    }
}
