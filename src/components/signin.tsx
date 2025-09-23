// src/components/signin.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Github, Mail } from "lucide-react";
import Link from "next/link";

interface Provider {
  id: string;
  name: string;
}

interface SignInProps {
  providers: Record<string, Provider> | null;
  mode?: "signin" | "signup";
}

export default function SignIn({ providers = null, mode = "signin" }: SignInProps) {
  const params = useSearchParams();
  const error = params?.get("error");
  const callbackUrl = params?.get("callbackUrl") ?? "/dashboard";
  const [pending, setPending] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const isSignup = mode === "signup";
  const title = isSignup ? "Create your ProjectFlow account" : "Welcome back";
  const subtitle = isSignup ? "Choose a provider to create your account" : "Choose a provider to continue";
  const switchHref = isSignup ? "/auth/signin" : "/auth/signup";
  const switchText = isSignup ? "Already have an account? Sign in" : "New here? Create an account";

  const providerList = useMemo(() => {
    if (!providers) return [] as Provider[];
    return Object.values(providers).filter(Boolean) as Provider[];
  }, [providers]);

  const handleSignIn = useCallback(async (providerId: string) => {
    try {
      setPending(providerId);
      await signIn(providerId, { callbackUrl });
    } finally {
      setPending(null);
    }
  }, [callbackUrl]);

  const handleCredentials = useCallback(async () => {
    setFormError(null);
    if (!email || !password) {
      setFormError("Please enter both email and password.");
      return;
    }
    setFormLoading(true);
    try {
      if (isSignup) {
        // Create the user then sign them in
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Failed to create account");
        }
      }
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });
      const r = result as any;
      if (r?.error) {
        setFormError(r.error || "Invalid email or password.");
        return;
      }
      // Successful login. Prefer server-provided URL, else fallback.
      const target = r?.url || callbackUrl;
      window.location.assign(target);
    } catch (e: any) {
      setFormError(e.message || "Something went wrong");
    } finally {
      setFormLoading(false);
    }
  }, [email, password, callbackUrl, isSignup]);

  return (
    <div className="flex h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Github className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Authentication error: {error}
            </div>
          ) : null}

          {formError ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          {/* OAuth Providers */}
          <div className="space-y-3">
            {providerList.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground">No providers configured</div>
            ) : (
              providerList.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full justify-center"
                  disabled={!!pending}
                  onClick={() => handleSignIn(provider.id)}
                >
                  {provider.id === "github" ? (
                    <Github className="mr-2 h-4 w-4" />
                  ) : provider.id === "google" ? (
                    <Mail className="mr-2 h-4 w-4" />
                  ) : null}
                  {pending === provider.id
                    ? (isSignup ? "Signing up..." : "Signing in...")
                    : (isSignup ? `Sign up with ${provider.name}` : `Sign in with ${provider.name}`)}
                </Button>
              ))
            )}
          </div>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">OR</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Email / Password Form */}
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
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm" htmlFor="password">Password</label>
                {!isSignup && (
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                )}
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-2 focus:ring-ring"
                placeholder="Your password"
                autoComplete={isSignup ? "new-password" : "current-password"}
              />
            </div>
            <Button onClick={handleCredentials} className="w-full justify-center" disabled={formLoading}>
              {formLoading ? (isSignup ? "Creating account..." : "Signing in...") : (isSignup ? "Create account" : "Sign in")}
            </Button>
          </div>

          <div className="mt-6 text-center text-xs text-muted-foreground">
            By continuing, you agree to our Terms and acknowledge our Privacy Policy.
          </div>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <Link href={switchHref} className="text-primary hover:underline">
              {switchText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}