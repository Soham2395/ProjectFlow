import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "../../../components/kanban/board";
import ProjectChatModal from "@/components/chat/project-chat-modal";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const { id: projectId } = params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/");

  // Ensure user is a member
  const member = await prisma.projectMember.findFirst({ where: { userId: session.user.id, projectId } });
  if (!member) redirect("/dashboard");

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) redirect("/dashboard");

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
    },
    orderBy: [
      { status: "asc" },
      { sortOrder: "asc" },
      { createdAt: "asc" },
    ],
  });

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description ? (
            <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
          ) : null}
        </div>
        <ProjectChatModal
          projectId={projectId}
          currentUser={{
            id: session.user.id,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
          }}
          buttonText="Open Chat"
        />
      </div>

      <KanbanBoard
        projectId={projectId}
        initialTasks={tasks as any}
        members={members.map((m: { user: { id: string; name: string | null; email: string | null; image: string | null } }) => m.user)}
      />

      {/* Optional floating button for mobile */}
      <div className="fixed bottom-6 right-6 lg:hidden">
        <ProjectChatModal
          projectId={projectId}
          currentUser={{
            id: session.user.id,
            name: session.user.name ?? null,
            image: session.user.image ?? null,
          }}
          buttonText="Chat"
        />
      </div>
    </main>
  );
}
