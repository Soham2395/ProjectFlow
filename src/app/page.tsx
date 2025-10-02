"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Layout, Users, BarChart3, Check } from "lucide-react"
import { motion } from "framer-motion"
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials"
import { TestimonialsSection } from "@/components/ui/testimonials-with-marquee"
import { HeroScrollDemo } from "@/components/hero-scroll-demo"

export default function Home() {
  return (
    <>
      <HeroScrollDemo />
      <main className="container mx-auto max-w-7xl px-4 py-16 md:py-24">

      {/* How it works */}
      <section className="mx-auto mt-20 max-w-5xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 md:grid-cols-3">
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="group rounded-xl border p-6 bg-background/50 transition-colors hover:bg-background hover:border-primary/20 hover:shadow-md"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 1 }}
              className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <Layout className="size-5" />
            </motion.div>
            <h3 className="mt-4 font-semibold">Plan</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create projects, define milestones and break down work with tasks and epics.
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="group rounded-xl border p-6 bg-background/50 transition-colors hover:bg-background hover:border-primary/20 hover:shadow-md"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 1 }}
              className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <Users className="size-5" />
            </motion.div>
            <h3 className="mt-4 font-semibold">Collaborate</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep everyone aligned with comments, mentions and real-time updates.
            </p>
          </motion.div>
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="group rounded-xl border p-6 bg-background/50 transition-colors hover:bg-background hover:border-primary/20 hover:shadow-md"
          >
            <motion.div
              whileHover={{ scale: 1.05, rotate: 1 }}
              className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary"
            >
              <BarChart3 className="size-5" />
            </motion.div>
            <h3 className="mt-4 font-semibold">Ship</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Measure progress with reports and analytics to ship with confidence.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Powerful features</h2>
        <AnimatedTestimonials
          className="mt-8"
          autoplay
          testimonials={[
            {
              quote:
                "Visualize and move work quickly with intuitive drag-and-drop Kanban.",
              name: "Kanban boards",
              designation: "Plan and prioritize with ease",
              src:
                "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80",
            },
            {
              quote:
                "Collaborate in real time with comments, mentions, and live updates.",
              name: "Real-time collaboration",
              designation: "Keep everyone in sync",
              src:
                "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            },
            {
              quote:
                "Track progress and spot bottlenecks with clear insights and reports.",
              name: "Insights & analytics",
              designation: "Make data-driven decisions",
              src:
                "https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
            },
            {
              quote:
                "Summarize updates, auto-tag issues, and suggest next steps with AI.",
              name: "AI assistance",
              designation: "Work smarter, not harder",
              src:
                "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
            },
            {
              quote:
                "Plan sprints, define milestones, and ship on schedule.",
              name: "Sprint planning",
              designation: "Align work to outcomes",
              src:
                "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80",
            },
            {
              quote:
                "Stay informed with smart notifications across devices.",
              name: "Notifications",
              designation: "Never miss a change",
              src:
                "https://images.unsplash.com/photo-1494173853739-c21f58b16055?auto=format&fit=crop&w=1200&q=80",
            },
          ]}
        />
      </section>

      {/* Testimonials */}
      <TestimonialsSection
        className="mt-20"
        title="Trusted by developers worldwide"
        description="Join thousands of teams shipping faster with ProjectFlow."
        testimonials={[
          {
            author: {
              name: "Emma Thompson",
              handle: "@emmaai",
              avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80&crop=faces",
            },
            text:
              "ProjectFlow transformed how we plan and track work. The analytics helped us cut cycle time by 30%.",
            href: "https://twitter.com/emmaai",
          },
          {
            author: {
              name: "David Park",
              handle: "@davidtech",
              avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&h=150&q=80&crop=faces",
            },
            text:
              "Real-time collaboration is a game changer. We reduced handoffs and ship more often.",
            href: "https://twitter.com/davidtech",
          },
          {
            author: {
              name: "Sofia Rodriguez",
              handle: "@sofiaml",
              avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80&crop=faces",
            },
            text:
              "Finally a tool that keeps our team aligned without getting in the way.",
          },
        ]}
      />

      {/* Pricing */}
      <section className="mx-auto mt-20 max-w-6xl">
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Simple, transparent pricing</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">Two plans: start free, unlock AI and unlimited projects when you’re ready.</p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {[{
            name: "Free",
            price: "$0",
            period: "/mo",
            description: "For individuals getting started",
            features: [
              "Up to 3 projects",
              "Kanban & tasks",
              "Comments & mentions",
              "Basic analytics",
            ],
            cta: "Start free",
            href: "/auth/signup",
            highlight: false,
          }, {
            name: "Paid",
            price: "$12",
            period: "/user/mo",
            description: "For teams who want to move faster with AI",
            features: [
              "Unlimited projects",
              "All AI features (summaries, auto-tagging, suggestions)",
              "Advanced analytics & reports",
              "Priority support",
            ],
            cta: "Upgrade",
            href: "/auth/signup",
            highlight: true,
          }].map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 shadow-sm transition-shadow hover:shadow-md ${plan.highlight ? "ring-2 ring-primary bg-primary/5" : ""}`}
            >
              {plan.highlight && (
                <span className="absolute right-4 top-4 rounded-full border bg-background px-2 py-1 text-xs font-medium">Most popular</span>
              )}
              <h3 className="text-lg font-semibold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-6 flex items-end gap-1">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && <span className="pb-1 text-sm text-muted-foreground">{plan.period}</span>}
              </div>
              <ul className="mt-6 space-y-2 text-sm">
                {plan.features.map((f: string) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="mt-0.5 inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Check className="size-3.5" />
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button asChild size="lg" variant={plan.highlight ? "default" : "outline"}>
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-20 max-w-5xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[{
            q: "What’s included in the Free plan?",
            a: "Core features with up to 3 projects, Kanban boards, comments, and basic analytics.",
          },{
            q: "What do I get with the Paid plan?",
            a: "All AI features (summaries, auto-tagging, suggestions), unlimited projects, advanced analytics, and priority support.",
          },{
            q: "Can I switch plans later?",
            a: "Yes. You can upgrade or downgrade anytime — your data stays intact.",
          },{
            q: "Do you offer team billing?",
            a: "Yes. Add team members under one subscription and manage roles centrally.",
          }].map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border bg-background/50 p-6 transition-colors hover:bg-background hover:border-primary/20 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <span className="text-left text-base font-medium md:text-lg">{item.q}</span>
                <span className="flex size-7 items-center justify-center rounded-full border bg-background">
                  <Check className="size-4 opacity-0 transition-opacity duration-200 group-open:opacity-100" />
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground md:text-[15px]">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto my-16 max-w-5xl overflow-hidden rounded-2xl border bg-gradient-to-br from-background to-muted p-8 text-center md:p-12">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to move faster?</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Start planning, collaborating, and shipping with ProjectFlow today.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Create your first project</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/signup">Start free</Link>
          </Button>
        </div>
      </section>
      </main>
    </>
  )
}
