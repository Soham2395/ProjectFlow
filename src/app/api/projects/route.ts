import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { sendInvitationEmail } from "@/lib/mailer";
import { createNotification } from "@/lib/notifications";

// GET /api/projects - list projects for current user (optionally filtered by org/workspace)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const organizationId = url.searchParams.get("organizationId");
  const workspaceId = url.searchParams.get("workspaceId");

  const whereClause: any = {
    members: { some: { userId: session.user.id } },
  };

  if (organizationId) {
    whereClause.organizationId = organizationId;
  }

  if (workspaceId) {
    whereClause.workspaceId = workspaceId;
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      members: {
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ projects });
}

// POST /api/projects - create a project with optional members by email
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { name, description, memberEmails, organizationId, workspaceId } = body as {
    name?: string;
    description?: string | null;
    memberEmails?: string[];
    organizationId?: string;
    workspaceId?: string;
  };

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!organizationId) {
    return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
  }

  // Import org permissions after defining the route
  const { assertOrgAccess } = await import("@/lib/org-permissions");

  try {
    // Verify user has access to the organization (member or higher)
    await assertOrgAccess(session.user.id, organizationId, "member");
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // If workspaceId is provided, verify it belongs to the organization
  if (workspaceId) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        organizationId,
      },
    });

    if (!workspace) {
      return NextResponse.json(
        { error: "Workspace not found or doesn't belong to this organization" },
        { status: 400 }
      );
    }
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: session.user.id,
      organizationId,
      workspaceId: workspaceId || null,
      members: {
        create: [{ userId: session.user.id, role: "admin" }],
      },
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      invitations: true,
    },
  });

  // Create invitations for provided emails (excluding creator's email)
  if (Array.isArray(memberEmails) && memberEmails.length) {
    const emails = memberEmails
      .map((e) => (typeof e === "string" ? e.trim().toLowerCase() : ""))
      .filter(Boolean)
      .filter((e) => e !== (session.user!.email?.toLowerCase() || ""));
    const uniqueEmails = Array.from(new Set(emails));
    if (uniqueEmails.length) {
      // Create invitations for emails that don't already have pending invitations
      for (const email of uniqueEmails) {
        // Check if invitation already exists
        const existing = await prisma.invitation.findFirst({
          where: {
            email,
            projectId: project.id,
            status: "pending",
          },
        });

        // Only create if doesn't exist
        if (!existing) {
          await prisma.invitation.create({
            data: {
              email,
              projectId: project.id,
              organizationId,
              role: "member",
              token: crypto.randomUUID(),
              status: "pending",
              invitedBy: session.user.id,
            },
          });
        }
      }

      // Log invitation URLs (stub for sending emails)
      const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const pending = await prisma.invitation.findMany({
        where: { email: { in: uniqueEmails }, projectId: project.id, status: "pending" },
        select: { token: true, email: true },
      });
      for (const p of pending) {
        const acceptUrl = `${origin}/invitations/accept?token=${p.token}`;
        console.log(`[invite] ${p.email}: ${acceptUrl}`);
        // Send email (falls back to console if SMTP is not configured)
        await sendInvitationEmail({
          to: p.email,
          acceptUrl,
          projectName: project.name,
          invitedBy: session.user.email || session.user.id,
        });

        // If the invited user already exists, send an in-app notification
        const invitedUser = await prisma.user.findFirst({ where: { email: p.email.toLowerCase() } });
        if (invitedUser?.id) {
          await createNotification({
            userId: invitedUser.id,
            projectId: project.id,
            type: "invitation",
            payload: {
              projectName: project.name,
              invitedBy: session.user.email || session.user.id,
              acceptUrl,
            },
          });
        }
      }
    }
  }

  // Re-fetch project with updated invitations
  const updated = await prisma.project.findUnique({
    where: { id: project.id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      workspace: {
        select: {
          id: true,
          name: true,
        },
      },
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
      invitations: true,
    },
  });

  return NextResponse.json({ project: updated }, { status: 201 });
}
