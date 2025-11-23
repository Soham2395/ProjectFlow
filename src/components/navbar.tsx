"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/theme-toggle";
import { BarChart3, Bell, LayoutDashboard, Menu } from "lucide-react";
import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getSocket } from "@/lib/socket-client";

export function Navbar() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const socket = useMemo(() => getSocket(), []);
  const [unread, setUnread] = useState<number>(0);
  const [latest, setLatest] = useState<Array<{ id: string; type: string; createdAt: string; payload: any }>>([]);

  const handleSignIn = async () => {
    await signIn(undefined, { callbackUrl: "/dashboard" });
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
  };

  // Subscribe to notifications
  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    socket.emit("joinUser", session.user.id);

    const fetchInitial = async () => {
      try {
        const res = await fetch(`/api/notifications?status=all&limit=10`, { cache: "no-store" });
        const data = await res.json();
        if (res.ok) {
          setUnread(data.unread || 0);
          setLatest(data.notifications || []);
        }
      } catch {}
    };
    fetchInitial();

    const onNew = (notif: any) => {
      setLatest((prev) => [notif, ...prev].slice(0, 10));
      setUnread((u) => u + 1);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [status, session?.user?.id, socket]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="hidden font-bold sm:inline-block">ProjectFlow</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center space-x-6 text-sm font-medium md:flex">
          <Link
            href="/"
            className="text-foreground/60 transition-colors hover:text-foreground/80"
          >
            Home
          </Link>
          <Link
            href="/dashboard"
            className="text-foreground/60 transition-colors hover:text-foreground/80"
          >
            Dashboard
          </Link>
          <Link
            href="/analytics"
            className="text-foreground/60 transition-colors hover:text-foreground/80"
          >
            Analytics
          </Link>
        </nav>

        {/* Right side actions */}
        <div className="flex items-center space-x-4">
          <ThemeToggle />
          {/* Notifications */}
          {status === "authenticated" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-medium text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-80" align="end" forceMount>
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notifications</span>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={async () => {
                      try {
                        await fetch("/api/notifications/mark-read", { method: "POST" });
                        setUnread(0);
                      } catch {}
                    }}
                  >
                    Mark all read
                  </button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {latest.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">No notifications</div>
                ) : (
                  latest.map((n) => (
                    <DropdownMenuItem key={n.id} className="block whitespace-normal text-sm leading-5">
                      <div>
                        <div className="font-medium">{n.type.replace(/_/g, " ")}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(n.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/notifications" className="w-full text-center text-sm text-primary">
                    View all
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : status !== "loading" ? (
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Notifications"
              onClick={() => signIn(undefined, { callbackUrl: "/dashboard" })}
              title="Sign in to view notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
          ) : null}
          {status === "loading" ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : status === "authenticated" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={session.user?.image ?? undefined}
                      alt={session.user?.name ?? "User"}
                    />
                    <AvatarFallback>
                      {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user?.name}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {session.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex w-full items-center">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={handleSignIn}>
              Sign in
            </Button>
          )}

          {/* Mobile menu button */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
