"use client";
import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check } from "lucide-react";
import home from "../../public/home.png";
import homeLight from "../../public/home-light.png";

export function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden pt-16 md:pt-24 pb-8">
      <ContainerScroll
        titleComponent={
          <div className="mx-auto max-w-4xl px-4">
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
              Introducing ProjectFlow
            </div>
            <h1 className="mt-4 text-balance text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-black dark:text-white">
              Plan, track and ship faster with ProjectFlow
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-balance text-sm text-muted-foreground md:text-base">
              Streamline your workflow with intuitive task management, real-time collaboration
              and powerful analytics — all in one platform.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/dashboard">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/analytics">View analytics</Link>
              </Button>
            </div>
          </div>
        }
      >
        <div className="relative">
          <Image
            src={homeLight}
            alt="ProjectFlow dashboard preview"
            height={900}
            width={1400}
            className="mx-auto rounded-2xl object-cover object-center shadow-lg block dark:hidden"
            priority
          />
          <Image
            src={home}
            alt="ProjectFlow dashboard preview"
            height={900}
            width={1400}
            className="mx-auto rounded-2xl object-cover object-center shadow-lg hidden dark:block"
            priority
          />
        </div>
      </ContainerScroll>
    </div>
  );
}
