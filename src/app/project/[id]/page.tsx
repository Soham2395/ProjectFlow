import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import KanbanBoard from "../../../components/kanban/board";

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description ? (
          <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>
        ) : null}
      </div>

      <KanbanBoard
        projectId={projectId}
        initialTasks={tasks as any}
        members={members.map((m: { user: { id: string; name: string | null; email: string | null; image: string | null } }) => m.user)}
      />
    </main>
  );
}
