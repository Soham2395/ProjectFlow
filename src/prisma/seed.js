/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create demo users
  const [alice, bob, carol] = await Promise.all([
    prisma.user.upsert({
      where: { email: "alice@example.com" },
      update: {},
      create: {
        name: "Alice Johnson",
        email: "alice@example.com",
        image: null,
      },
    }),
    prisma.user.upsert({
      where: { email: "bob@example.com" },
      update: {},
      create: {
        name: "Bob Lee",
        email: "bob@example.com",
        image: null,
      },
    }),
    prisma.user.upsert({
      where: { email: "carol@example.com" },
      update: {},
      create: {
        name: "Carol Smith",
        email: "carol@example.com",
        image: null,
      },
    }),
  ]);

  // Create a project
  const project = await prisma.project.create({
    data: {
      name: "Project Flow Demo",
      description: "A demo project with tasks, labels, and comments.",
      members: {
        create: [
          { userId: alice.id, role: "admin" },
          { userId: bob.id, role: "member" },
          { userId: carol.id, role: "member" },
        ],
      },
    },
  });

  // Create labels
  const [frontend, backend, bug, enhancement] = await Promise.all([
    prisma.label.upsert({
      where: { name: "frontend" },
      update: {},
      create: { name: "frontend", color: "#22c55e" },
    }),
    prisma.label.upsert({
      where: { name: "backend" },
      update: {},
      create: { name: "backend", color: "#3b82f6" },
    }),
    prisma.label.upsert({
      where: { name: "bug" },
      update: {},
      create: { name: "bug", color: "#ef4444" },
    }),
    prisma.label.upsert({
      where: { name: "enhancement" },
      update: {},
      create: { name: "enhancement", color: "#a855f7" },
    }),
  ]);

  const now = new Date();
  const in3d = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Create tasks with labels, assignees, and comments
  const task1 = await prisma.task.create({
    data: {
      title: "Set up project skeleton",
      description: "Initialize Next.js app and configure Tailwind.",
      status: "done",
      priority: "high",
      dueDate: in3d,
      projectId: project.id,
      assigneeId: alice.id,
      labels: { connect: [{ id: frontend.id }] },
      comments: {
        create: [
          { userId: alice.id, content: "Project initialized with Next.js 15." },
          { userId: bob.id, content: "Tailwind configured and working." },
        ],
      },
    },
  });

  const task2 = await prisma.task.create({
    data: {
      title: "Implement authentication",
      description: "NextAuth with email/password and OAuth.",
      status: "in_progress",
      priority: "high",
      dueDate: in7d,
      projectId: project.id,
      assigneeId: bob.id,
      labels: { connect: [{ id: backend.id }, { id: enhancement.id }] },
      comments: {
        create: [
          { userId: carol.id, content: "Let's add password reset flow too." },
        ],
      },
    },
  });

  const task3 = await prisma.task.create({
    data: {
      title: "Fix task drag-and-drop bug",
      description: "Board crashes when dragging tasks quickly.",
      status: "todo",
      priority: "medium",
      dueDate: in14d,
      projectId: project.id,
      assigneeId: carol.id,
      labels: { connect: [{ id: bug.id }] },
      comments: {
        create: [
          { userId: alice.id, content: "I can reproduce on Chrome only." },
          { userId: carol.id, content: "Investigating event listeners." },
        ],
      },
    },
  });

  console.log("Seeded:", { users: [alice.email, bob.email, carol.email], project: project.name, tasks: [task1.title, task2.title, task3.title] });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
