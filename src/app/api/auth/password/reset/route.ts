import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email, code, newPassword } = await req.json();
    if (!email || !code || !newPassword) {
      return NextResponse.json({ message: "Email, code and newPassword are required" }, { status: 400 });
    }

    const vt = await prisma.verificationToken.findUnique({ where: { token: code } });
    if (!vt || vt.identifier !== email || vt.expires < new Date()) {
      return NextResponse.json({ message: "Invalid or expired code" }, { status: 400 });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { email }, data: { password: hash } });

    // Invalidate used token(s)
    await prisma.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Unexpected error" }, { status: 500 });
  }
}
