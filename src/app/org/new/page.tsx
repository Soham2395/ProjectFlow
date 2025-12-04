"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/components/organization";
import { Building2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateOrganizationPage() {
    const router = useRouter();
    const { refetch } = useOrganization();
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const generateSlug = (value: string) => {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 50);
    };

    const handleNameChange = (value: string) => {
        setName(value);
        // Auto-generate slug from name if slug is empty or was auto-generated
        if (!slug || slug === generateSlug(name)) {
            setSlug(generateSlug(value));
        }
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");

        if (!name.trim()) {
            setError("Organization name is required");
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch("/api/organizations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim() || undefined,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to create organization");
            }

            await refetch();
            router.push("/dashboard");
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to create organization");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="container mx-auto max-w-xl px-4 py-10">
            <Link
                href="/dashboard"
                className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
            </Link>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold">Create Organization</h1>
                        <p className="text-sm text-muted-foreground">
                            Organizations help you manage projects and team members
                        </p>
                    </div>
                </div>

                {error && (
                    <div className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Organization Name *</label>
                        <input
                            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                            value={name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder="Acme Corp"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">
                            URL Slug
                            <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
                        </label>
                        <input
                            className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                            value={slug}
                            onChange={(e) => setSlug(generateSlug(e.target.value))}
                            placeholder="acme-corp"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                            Used in URLs. Only lowercase letters, numbers, and hyphens.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={submitting}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting}>
                            {submitting ? "Creating..." : "Create Organization"}
                        </Button>
                    </div>
                </form>
            </div>
        </main>
    );
}
