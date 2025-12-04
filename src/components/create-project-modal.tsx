"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/components/organization";

type Props = {
  onCreated?: () => void;
};

export default function CreateProjectModal({ onCreated }: Props) {
  const router = useRouter();
  const { currentOrg, isLoading: orgLoading } = useOrganization();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmails, setMemberEmails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) return;

    if (!currentOrg) {
      setError("Please select an organization first");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          organizationId: currentOrg.id,
          memberEmails: memberEmails
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create project");
      }

      setOpen(false);
      setName("");
      setDescription("");
      setMemberEmails("");
      if (onCreated) onCreated();
      else router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  }

  // Don't show the button if org is loading or no org selected
  if (orgLoading) return null;

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Create project"
        disabled={!currentOrg}
        title={currentOrg ? `Create project in ${currentOrg.name}` : "Select an organization first"}
      >
        +
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-lg rounded-lg border bg-background p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Create Project</h2>
            {currentOrg && (
              <p className="mt-1 text-sm text-muted-foreground">
                This project will be created in <strong>{currentOrg.name}</strong>
              </p>
            )}
            {error && (
              <div className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium">Name</label>
                <input
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Project name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Members (emails, comma-separated)</label>
                <input
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
                  value={memberEmails}
                  onChange={(e) => setMemberEmails(e.target.value)}
                  placeholder="alice@example.com, bob@example.com"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

