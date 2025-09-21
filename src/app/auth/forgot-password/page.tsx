"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  async function requestCode() {
    setError(null);
    setMessage(null);
    if (!email) {
      setError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.retryAfter) setCooldown(Number(data.retryAfter));
        throw new Error(data?.message || "Failed to request code.");
      }
      setMessage(data?.message || "If an account exists for this email, a 6-digit code has been sent. Check your inbox.");
      setStep("verify");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError(null);
    setMessage(null);
    if (!email || !code || !password) {
      setError("Please fill all fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || "Invalid code or request.");
      }
      setMessage("Password updated. You can now sign in with your new password.");
    } catch (e: any) {
      setError(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  // simple cooldown timer
  if (cooldown > 0) {
    setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold tracking-tight">Forgot password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          {step === "request"
            ? "Enter your email to receive a 6-digit reset code."
            : "Enter the 6-digit code and your new password."}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-600">
            {message}
          </div>
        )}

        {step === "request" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            <Button onClick={requestCode} className="w-full" disabled={loading || cooldown > 0}>
              {loading ? "Sending code..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Send reset code"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm" htmlFor="code">6-digit code</label>
              <input
                id="code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
                placeholder="123456"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm" htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
                placeholder="Your new password"
                autoComplete="new-password"
              />
            </div>
            <Button onClick={resetPassword} className="w-full" disabled={loading}>
              {loading ? "Resetting..." : "Reset password"}
            </Button>
            <div className="text-center">
              <Button variant="ghost" type="button" onClick={requestCode} disabled={loading || cooldown > 0}>
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/auth/signin" className="text-primary hover:underline">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
