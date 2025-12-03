"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Clock, FileText, FolderKanban, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useSearch } from "@/lib/hooks/use-search";
import { getRecentSearches, clearRecentSearches, type RecentSearch } from "@/lib/search-utils";

export function GlobalSearch() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    const { results, loading, search, clear } = useSearch();
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    // Load recent searches when popover opens
    useEffect(() => {
        if (open) {
            setRecentSearches(getRecentSearches());
        }
    }, [open]);

    // Perform search when query changes
    useEffect(() => {
        if (query.trim()) {
            search(query, { type: "all" });
        } else {
            clear();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query]);

    const handleTaskClick = (taskId: string, projectId: string) => {
        setOpen(false);
        setQuery("");
        router.push(`/project/${projectId}?taskId=${taskId}`);
    };

    const handleProjectClick = (projectId: string) => {
        setOpen(false);
        setQuery("");
        router.push(`/project/${projectId}`);
    };

    const handleRecentSearchClick = (recentQuery: string) => {
        setQuery(recentQuery);
        inputRef.current?.focus();
    };

    const handleClearRecent = () => {
        clearRecentSearches();
        setRecentSearches([]);
    };

    const handleViewAll = () => {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query)}`);
    };

    const hasResults = results.tasks.length > 0 || results.projects.length > 0;
    const showRecent = !query.trim() && recentSearches.length > 0;
    const showEmpty = query.trim() && !loading && !hasResults;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverAnchor asChild>
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => setOpen(true)}
                        placeholder="Search tasks, projects..."
                        className="h-9 w-full pl-9 pr-9"
                    />
                    {query && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                            onClick={() => setQuery("")}
                        >
                            <X className="h-3 w-3" />
                        </Button>
                    )}
                </div>
            </PopoverAnchor>
            <PopoverContent className="w-[400px] p-0" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>

                <div className="max-h-[400px] overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {showRecent && (
                        <div className="p-2">
                            <div className="flex items-center justify-between px-2 py-1">
                                <div className="flex items-center text-xs font-medium text-muted-foreground">
                                    <Clock className="mr-1 h-3 w-3" />
                                    Recent Searches
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-xs"
                                    onClick={handleClearRecent}
                                >
                                    Clear
                                </Button>
                            </div>
                            {recentSearches.map((recent, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleRecentSearchClick(recent.query)}
                                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                                >
                                    <Clock className="mr-2 h-3 w-3 text-muted-foreground" />
                                    {recent.query}
                                </button>
                            ))}
                        </div>
                    )}

                    {showEmpty && (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                            <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                            <p>No results found for &quot;{query}&quot;</p>
                            <p className="mt-1 text-xs">Try adjusting your search</p>
                        </div>
                    )}

                    {hasResults && !loading && (
                        <>
                            {results.projects.length > 0 && (
                                <div className="p-2">
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                        Projects
                                    </div>
                                    {results.projects.slice(0, 5).map((project: any) => (
                                        <button
                                            key={project.id}
                                            onClick={() => handleProjectClick(project.id)}
                                            className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent"
                                        >
                                            <FolderKanban className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-medium">{project.name}</div>
                                                {project.description && (
                                                    <div className="truncate text-xs text-muted-foreground">
                                                        {project.description}
                                                    </div>
                                                )}
                                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{project.taskCount} tasks</span>
                                                    <span>•</span>
                                                    <span>{project.memberCount} members</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {results.tasks.length > 0 && (
                                <div className="p-2">
                                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                                        Tasks
                                    </div>
                                    {results.tasks.slice(0, 5).map((task: any) => (
                                        <button
                                            key={task.id}
                                            onClick={() => handleTaskClick(task.id, task.project.id)}
                                            className="flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left hover:bg-accent"
                                        >
                                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                                            <div className="flex-1 overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium">{task.title}</span>
                                                    <Badge
                                                        variant={
                                                            task.priority === "urgent"
                                                                ? "destructive"
                                                                : task.priority === "high"
                                                                    ? "default"
                                                                    : "secondary"
                                                        }
                                                        className="text-xs"
                                                    >
                                                        {task.priority}
                                                    </Badge>
                                                </div>
                                                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{task.project.name}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">{task.status.replace("_", " ")}</span>
                                                    {task.assignee && (
                                                        <>
                                                            <span>•</span>
                                                            <div className="flex items-center gap-1">
                                                                <Avatar className="h-4 w-4">
                                                                    <AvatarImage src={task.assignee.image || undefined} />
                                                                    <AvatarFallback className="text-[8px]">
                                                                        {task.assignee.name?.[0] || "?"}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span>{task.assignee.name}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="border-t p-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleViewAll}
                                >
                                    View all results
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
