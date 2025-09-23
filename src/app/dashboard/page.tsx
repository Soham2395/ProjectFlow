import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import CreateProjectModal from "@/components/create-project-modal";
import { ProjectCard } from "@/components/project-card";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  const projects = await prisma.project.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Pending invitations for this user's email
  const invitations = session.user.email
    ? await prisma.invitation.findMany({
        where: { email: session.user.email.toLowerCase(), status: "pending" },
        include: { project: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  type Member = { user: { id: string; name: string | null; email: string | null; image: string | null }; role: string };
  type ProjectItem = { id: string; name: string; description: string | null; createdAt: Date; members: Member[] };

  const sp = await searchParams;
  const errorRaw = sp?.inviteError;
  const successRaw = sp?.inviteSuccess;
  const errorKey = (Array.isArray(errorRaw) ? errorRaw[0] : errorRaw) || "";
  const successKey = (Array.isArray(successRaw) ? successRaw[0] : successRaw) || "";

  const errorMessage = errorKey === "missing_token"
    ? "Invitation token is missing."
    : errorKey === "invalid_or_expired"
    ? "This invitation is invalid or has expired."
    : errorKey === "email_mismatch"
    ? "This invitation is for a different email address."
    : "";

  const successMessage = successKey === "accepted" ? "Invitation accepted. You've been added to the project." : "";

  return (
    <main className="container mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">Your projects</p>
        </div>

        {/* Feedback for invitation accept flows */}
        <div className="w-full">
          {errorMessage ? (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertTitle>Invitation Error</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            </div>
          ) : null}
          {successMessage ? (
            <div className="mt-4">
              <Alert>
                <AlertTitle>Success</AlertTitle>
                <AlertDescription>{successMessage}</AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>

      {invitations.length > 0 && (
        <div className="mt-8 rounded-lg border p-5">
          <h2 className="text-lg font-semibold">Pending invitations</h2>
          <ul className="mt-3 space-y-3">
            {invitations.map((inv: { id: string; token: string; project: { name: string; description: string | null } }) => (
              <li key={inv.id} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{inv.project.name}</div>
                  <div className="text-xs text-muted-foreground">{inv.project.description}</div>
                </div>
                <a
                  href={`/invitations/accept?token=${encodeURIComponent(inv.token)}`}
                  className="text-sm font-medium text-primary underline"
                >
                  Accept
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>

      {projects.length === 0 ? (
        <div className="mt-10 rounded-lg border p-10 text-center text-muted-foreground">
          You have no projects yet. Click the + button to create one.
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p: ProjectItem) => {
            const me = p.members.find((m: Member) => m.user.id === session.user.id);
            const canAdmin = me?.role === "admin";
            return (
              <ProjectCard
                key={p.id}
                project={{
                  id: p.id,
                  name: p.name,
                  description: p.description,
                  createdAt: p.createdAt,
                  members: p.members,
                }}
                canAdmin={!!canAdmin}
              />
            );
          })}
        </div>
      )}

      {/* Floating create button with modal */}
      {/* Client component handles its own state and refresh on success */}
      <CreateProjectModal />
    </main>
  );
}
