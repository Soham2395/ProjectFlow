import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { sendOtpEmail } from "@/lib/mail";

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
}

// Simple in-memory rate limiter (per runtime instance)
// Limit: max 3 requests per 10 minutes per (email+ip), with 30s minimum interval
type Bucket = { count: number; windowStart: number; lastSentAt: number };
const REQUEST_WINDOW_MS = 10 * 60 * 1000;
const REQUEST_MAX = 3;
const REQUEST_COOLDOWN_MS = 30 * 1000;
const requestBuckets = new Map<string, Bucket>();

export async function POST(req: Request) {
  try {
    const { email: rawEmail } = await req.json();
    const email = (rawEmail || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }
    const hdrs = await headers();
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const key = `${email}|${ip}`;
    const now = Date.now();
    const b = requestBuckets.get(key);
    if (b) {
      // reset window
      if (now - b.windowStart > REQUEST_WINDOW_MS) {
        b.windowStart = now;
        b.count = 0;
      }
      // cooldown check
      if (now - b.lastSentAt < REQUEST_COOLDOWN_MS) {
        const waitSec = Math.ceil((REQUEST_COOLDOWN_MS - (now - b.lastSentAt)) / 1000);
        return NextResponse.json({ message: `Please wait ${waitSec}s before requesting a new code.`, retryAfter: waitSec }, { status: 429 });
      }
      if (b.count >= REQUEST_MAX) {
        const waitSec = Math.ceil((b.windowStart + REQUEST_WINDOW_MS - now) / 1000);
        return NextResponse.json({ message: "Too many requests. Try again in a few minutes.", retryAfter: Math.max(waitSec, 0) }, { status: 429 });
      }
      b.count += 1;
      b.lastSentAt = now;
      requestBuckets.set(key, b);
    } else {
      requestBuckets.set(key, { count: 1, windowStart: now, lastSentAt: now });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Do not reveal whether user exists

    const token = generateCode();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user) {
      // Remove any previous tokens for this email
      await prisma.verificationToken.deleteMany({ where: { identifier: email } }).catch(() => {});
      await prisma.verificationToken.create({
        data: {
          identifier: email,
          token,
          expires,
        },
      });
    }

    // Send email (uses Resend when configured, else console fallback in dev)
    await sendOtpEmail({ to: email, code: token, expiresInMinutes: 10 });

    return NextResponse.json({ ok: true, message: "If an account exists for this email, a 6-digit code has been sent." });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Unexpected error" }, { status: 500 });
  }
}
