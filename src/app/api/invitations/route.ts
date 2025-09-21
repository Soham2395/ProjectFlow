import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET /api/invitations - list pending invitations for the logged-in user's email
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

  const email = session.user.email.toLowerCase();
  const invitations = await prisma.invitation.findMany({
    where: { email, status: "pending" },
    include: { project: { select: { id: true, name: true, description: true } }, invitedByUser: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}
