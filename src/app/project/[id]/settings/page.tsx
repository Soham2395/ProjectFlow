"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";

interface RepoItem {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  owner: string;
  htmlUrl: string;
  defaultBranch: string;
  permissions?: { admin?: boolean; push?: boolean; pull?: boolean } | null;
  pushedAt?: string | null;
}

export default function ProjectSettingsPage() {
  const params = useParams<{ id: string }>();
  const projectId = useMemo(() => (Array.isArray(params?.id) ? params.id[0] : (params?.id as string)), [params]);

  const [isOwner, setIsOwner] = useState<boolean | null>(null);
  const [githubConnected, setGithubConnected] = useState<boolean | null>(null);
  const [repos, setRepos] = useState<RepoItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      // Fetch project info for ownership
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        const data = await res.json();
        if (res.ok) {
          setIsOwner(Boolean(data.isOwner));
        } else {
          // if forbidden or not found
          setError(data?.error || "Failed to load project");
        }
      } catch (e: any) {
        setError(e.message || "Failed to load project");
      }

      // Then fetch repos
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/github/repos`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 400 && (data?.error || "").toLowerCase().includes("not connected")) {
            setGithubConnected(false);
            setRepos([]);
          } else {
            throw new Error(data?.error || "Failed to load repositories");
          }
        } else {
          setGithubConnected(true);
          setRepos(data.repos || []);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load repositories");
      } finally {
        setLoading(false);
      }
    };
    if (projectId) bootstrap();
  }, [projectId]);

  const onConnect = async (repo: RepoItem) => {
    if (!projectId) return;
    if (!isOwner) {
      setError("Only the project owner can connect a repository.");
      return;
    }
    setConnecting(repo.fullName);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/github/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, repoOwner: repo.owner, repoName: repo.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to connect repo");
      setSuccess(`Connected ${repo.fullName} to this project`);
    } catch (e: any) {
      setError(e.message || "Failed to connect repo");
    } finally {
      setConnecting(null);
    }
  };

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Settings</h1>
        <div className="flex gap-2">
          <Link href={`/project/${projectId}`}>
            <Button variant="secondary">Back to Project</Button>
          </Link>
          <Link href={`/project/${projectId}/commits`}>
            <Button variant="ghost">View Commits</Button>
          </Link>
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Connect GitHub Repo</h2>
        <p className="text-sm text-muted-foreground">Select one of your repositories to link with this project. You must have admin or push access.</p>

        {isOwner === false ? (
          <Alert>
            <AlertTitle>Not Owner</AlertTitle>
            <AlertDescription>Only the project owner can connect a GitHub repository for this project.</AlertDescription>
          </Alert>
        ) : null}

        {githubConnected === false ? (
          <Alert>
            <AlertTitle>GitHub Not Connected</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>You are not signed in with GitHub. Connect your GitHub account to continue.</span>
              <div>
                <Button onClick={() => signIn("github", { callbackUrl: typeof window !== 'undefined' ? window.location.href : `/project/${projectId}/settings` })}>
                  Connect GitHub
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {success ? (
          <Alert>
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="text-sm">Loading repositories…</div>
        ) : repos && repos.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {repos.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="truncate font-medium">{r.fullName}</div>
                  <div className="text-xs text-muted-foreground flex gap-2">
                    <a className="hover:underline" href={r.htmlUrl} target="_blank" rel="noreferrer">View on GitHub</a>
                    <span>•</span>
                    <span>{r.private ? "Private" : "Public"}</span>
                    {r.pushedAt ? (
                      <>
                        <span>•</span>
                        <span>Last push: {new Date(r.pushedAt).toLocaleString()}</span>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <Button disabled={!!(connecting === r.fullName) || isOwner === false || githubConnected === false} onClick={() => onConnect(r)}>
                    {connecting === r.fullName ? "Connecting…" : isOwner === false ? "Owner Only" : "Connect"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>No repositories found.</div>
          </div>
        )}
      </section>
    </main>
  );
}
