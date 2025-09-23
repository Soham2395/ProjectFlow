import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";
import { sendInvitationEmail } from "@/lib/mailer";

// GET /api/projects - list projects for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
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
  const { name, description, memberEmails } = body as {
    name?: string;
    description?: string | null;
    memberEmails?: string[];
  };

  if (!name || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      ownerId: session.user.id,
      members: {
        create: [{ userId: session.user.id, role: "admin" }],
      },
    },
    include: {
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
      await prisma.$transaction(
        uniqueEmails.map((email) =>
          prisma.invitation.upsert({
            where: {
              // unique on (email, projectId, status) so we upsert if pending already exists
              email_projectId_status: { email, projectId: project.id, status: "pending" },
            } as any,
            create: {
              email,
              projectId: project.id,
              role: "member",
              token: crypto.randomUUID(),
              status: "pending",
              invitedBy: session.user.id,
            },
            update: {},
          })
        )
      );

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
      }
    }
  }

  // Re-fetch project with updated invitations
  const updated = await prisma.project.findUnique({
    where: { id: project.id },
    include: { members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } }, invitations: true },
  });

  return NextResponse.json({ project: updated }, { status: 201 });
}
