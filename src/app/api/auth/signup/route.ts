import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const { email: rawEmail, password } = await req.json();
    const email = (rawEmail || "").trim().toLowerCase();

    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ message: "Password must be at least 8 characters long." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "An account with this email already exists." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: {
        email,
        password: hash,
      },
    });

    return NextResponse.json({ ok: true, message: "Account created. You can now sign in." });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Unexpected error." }, { status: 500 });
  }
}
