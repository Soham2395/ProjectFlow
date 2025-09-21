import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const session = await getServerSession(authOptions);

  if (!token) {
    return NextResponse.redirect(new URL("/dashboard?inviteError=missing_token", url.origin));
  }

  if (!session?.user?.id || !session.user.email) {
    const callbackUrl = encodeURIComponent(`/invitations/accept?token=${encodeURIComponent(token)}`);
    return NextResponse.redirect(new URL(`/auth/signin?callbackUrl=${callbackUrl}`, url.origin));
  }

  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite || invite.status !== "pending") {
    return NextResponse.redirect(new URL(`/dashboard?inviteError=invalid_or_expired`, url.origin));
  }

  const userEmail = session.user.email.toLowerCase();
  if (invite.email.toLowerCase() !== userEmail) {
    return NextResponse.redirect(new URL(`/dashboard?inviteError=email_mismatch`, url.origin));
  }

  await prisma.projectMember.upsert({
    where: { userId_projectId: { userId: session.user.id, projectId: invite.projectId } } as any,
    update: {},
    create: { userId: session.user.id, projectId: invite.projectId, role: invite.role || "member" },
  });

  await prisma.invitation.update({ where: { id: invite.id }, data: { status: "accepted" } });

  return NextResponse.redirect(new URL(`/project/${invite.projectId}`, url.origin));
}
