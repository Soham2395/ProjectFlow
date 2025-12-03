"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, FileText, FolderKanban, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { buildSearchQuery } from "@/lib/search-utils";

export default function SearchPage() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [query, setQuery] = useState(searchParams?.get("q") || "");
    const [activeTab, setActiveTab] = useState(searchParams?.get("type") || "all");
    const [results, setResults] = useState<any>({ tasks: [], projects: [], commits: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const q = searchParams?.get("q") || "";
        const type = searchParams?.get("type") || "all";
        setQuery(q);
        setActiveTab(type);

        if (q.trim()) {
            performSearch(q, type);
        }
    }, [searchParams]);

    const performSearch = async (searchQuery: string, type: string) => {
        setLoading(true);
        setError(null);

        try {
            const queryString = buildSearchQuery({ q: searchQuery, type: type as any });
            const response = await fetch(`/api/search?${queryString}`);

            if (!response.ok) {
                throw new Error("Search failed");
            }

            const data = await response.json();
            setResults(data.results || { tasks: [], projects: [], commits: [] });
        } catch (err: any) {
            setError(err.message || "Search failed");
            setResults({ tasks: [], projects: [], commits: [] });
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query)}&type=${activeTab}`);
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query)}&type=${value}`);
        }
    };

    const handleTaskClick = (taskId: string, projectId: string) => {
        router.push(`/project/${projectId}?taskId=${taskId}`);
    };

    const handleProjectClick = (projectId: string) => {
        router.push(`/project/${projectId}`);
    };

    const totalResults = results.tasks.length + results.projects.length + results.commits.length;
    const showEmpty = query.trim() && !loading && totalResults === 0;

    return (
        <div className="container mx-auto max-w-5xl px-4 py-8">
            <div className="mb-8">
                <h1 className="mb-2 text-3xl font-bold">Search</h1>
                <p className="text-muted-foreground">
                    Search across tasks, projects, and more
                </p>
            </div>

            {/* Search Input */}
            <form onSubmit={handleSearch} className="mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tasks, projects..."
                        className="h-12 pl-10 text-base"
                        autoFocus
                    />
                </div>
            </form>

            {/* Results */}
            {query.trim() && (
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                    <TabsList className="mb-6">
                        <TabsTrigger value="all">
                            All
                            {!loading && totalResults > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {totalResults}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="task">
                            Tasks
                            {!loading && results.tasks.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {results.tasks.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="project">
                            Projects
                            {!loading && results.projects.length > 0 && (
                                <Badge variant="secondary" className="ml-2">
                                    {results.projects.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>

                    {loading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {showEmpty && (
                        <div className="py-12 text-center">
                            <FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground opacity-50" />
                            <h3 className="mb-2 text-lg font-semibold">No results found</h3>
                            <p className="text-sm text-muted-foreground">
                                Try adjusting your search query or filters
                            </p>
                        </div>
                    )}

                    {!loading && !showEmpty && (
                        <>
                            <TabsContent value="all" className="space-y-6">
                                {results.projects.length > 0 && (
                                    <div>
                                        <h2 className="mb-3 flex items-center text-lg font-semibold">
                                            <FolderKanban className="mr-2 h-5 w-5" />
                                            Projects
                                        </h2>
                                        <div className="space-y-2">
                                            {results.projects.map((project: any) => (
                                                <button
                                                    key={project.id}
                                                    onClick={() => handleProjectClick(project.id)}
                                                    className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                                                >
                                                    <FolderKanban className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold">{project.name}</h3>
                                                        {project.description && (
                                                            <p className="mt-1 text-sm text-muted-foreground">
                                                                {project.description}
                                                            </p>
                                                        )}
                                                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                                            <span>{project.taskCount} tasks</span>
                                                            <span>•</span>
                                                            <span>{project.memberCount} members</span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {results.tasks.length > 0 && (
                                    <div>
                                        <h2 className="mb-3 flex items-center text-lg font-semibold">
                                            <FileText className="mr-2 h-5 w-5" />
                                            Tasks
                                        </h2>
                                        <div className="space-y-2">
                                            {results.tasks.map((task: any) => (
                                                <button
                                                    key={task.id}
                                                    onClick={() => handleTaskClick(task.id, task.project.id)}
                                                    className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                                                >
                                                    <FileText className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-semibold">{task.title}</h3>
                                                            <Badge
                                                                variant={
                                                                    task.priority === "urgent"
                                                                        ? "destructive"
                                                                        : task.priority === "high"
                                                                            ? "default"
                                                                            : "secondary"
                                                                }
                                                            >
                                                                {task.priority}
                                                            </Badge>
                                                        </div>
                                                        {task.description && (
                                                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                                {task.description}
                                                            </p>
                                                        )}
                                                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                            <span>{task.project.name}</span>
                                                            <span>•</span>
                                                            <span className="capitalize">
                                                                {task.status.replace("_", " ")}
                                                            </span>
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
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="task" className="space-y-2">
                                {results.tasks.length > 0 ? (
                                    results.tasks.map((task: any) => (
                                        <button
                                            key={task.id}
                                            onClick={() => handleTaskClick(task.id, task.project.id)}
                                            className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                                        >
                                            <FileText className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-semibold">{task.title}</h3>
                                                    <Badge
                                                        variant={
                                                            task.priority === "urgent"
                                                                ? "destructive"
                                                                : task.priority === "high"
                                                                    ? "default"
                                                                    : "secondary"
                                                        }
                                                    >
                                                        {task.priority}
                                                    </Badge>
                                                </div>
                                                {task.description && (
                                                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                                        {task.description}
                                                    </p>
                                                )}
                                                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                                                    <span>{task.project.name}</span>
                                                    <span>•</span>
                                                    <span className="capitalize">
                                                        {task.status.replace("_", " ")}
                                                    </span>
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
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-muted-foreground">
                                        No tasks found
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="project" className="space-y-2">
                                {results.projects.length > 0 ? (
                                    results.projects.map((project: any) => (
                                        <button
                                            key={project.id}
                                            onClick={() => handleProjectClick(project.id)}
                                            className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent"
                                        >
                                            <FolderKanban className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
                                            <div className="flex-1">
                                                <h3 className="font-semibold">{project.name}</h3>
                                                {project.description && (
                                                    <p className="mt-1 text-sm text-muted-foreground">
                                                        {project.description}
                                                    </p>
                                                )}
                                                <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                                    <span>{project.taskCount} tasks</span>
                                                    <span>•</span>
                                                    <span>{project.memberCount} members</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-12 text-center text-muted-foreground">
                                        No projects found
                                    </div>
                                )}
                            </TabsContent>
                        </>
                    )}
                </Tabs>
            )}

            {!query.trim() && (
                <div className="py-12 text-center text-muted-foreground">
                    <Search className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>Enter a search query to get started</p>
                </div>
            )}
        </div>
    );
}
