import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="container mx-auto max-w-7xl px-4 py-16 md:py-24">
      <section className="mx-auto max-w-4xl text-center">
        <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
          Introducing ProjectFlow
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Plan, track, and ship projects faster
        </h1>
        <p className="mt-4 text-base text-muted-foreground md:text-lg">
          Streamline your workflow with intuitive task management, real-time collaboration,
          and powerful analytics—all in one platform. Ship better and work faster.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link href="/dashboard">Get started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/analytics">View analytics</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto mt-16 grid max-w-5xl gap-6 sm:grid-cols-2 md:grid-cols-3">
        <div className="rounded-xl border p-6">
          <h3 className="font-semibold">Kanban Boards</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize work and manage tasks with drag-and-drop boards.
          </p>
        </div>
        <div className="rounded-xl border p-6">
          <h3 className="font-semibold">Real-time Collaboration</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your team in sync with live updates and comments.
          </p>
        </div>
        <div className="rounded-xl border p-6">
          <h3 className="font-semibold">Insights & Analytics</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Track progress and make data-driven decisions.
          </p>
        </div>
      </section>
    </main>
  )
}
