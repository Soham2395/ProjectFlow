"use client";

import { useEffect, useState, use } from "react";
import { Search, Filter, Grid, List as ListIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select-input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentList } from "@/components/upload/attachment-list";
import { FileUpload } from "@/components/upload/file-upload";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ProjectFilesPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: projectId } = use(params);
    const [attachments, setAttachments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");
    const [uploadOpen, setUploadOpen] = useState(false);

    const fetchAttachments = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (typeFilter !== "all") params.append("type", typeFilter);

            const res = await fetch(`/api/attachments/project/${projectId}?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setAttachments(data.attachments || []);
            }
        } catch (error) {
            console.error("Failed to fetch attachments:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAttachments();
    }, [projectId, typeFilter]);

    const filteredAttachments = attachments.filter((att) =>
        att.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id: string) => {
        try {
            const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
            if (res.ok) {
                setAttachments((prev) => prev.filter((a) => a.id !== id));
            }
        } catch (error) {
            console.error("Failed to delete attachment:", error);
        }
    };

    return (
        <div className="flex h-full flex-col space-y-6 p-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Project Files</h1>
                    <p className="text-muted-foreground">
                        Manage and view all files attached to this project.
                    </p>
                </div>
                <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload File
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <div className="p-4">
                            <DialogTitle className="mb-4 text-lg font-semibold">Upload File</DialogTitle>
                            <DialogDescription className="sr-only">
                                Upload a file to attach to this project
                            </DialogDescription>
                            <FileUpload
                                projectId={projectId}
                                onUploadComplete={(attachment) => {
                                    setAttachments((prev) => [attachment, ...prev]);
                                    setUploadOpen(false);
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search files..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <SelectTrigger className="w-[150px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            <SelectItem value="image">Images</SelectItem>
                            <SelectItem value="document">Documents</SelectItem>
                            <SelectItem value="video">Videos</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center rounded-md border bg-muted p-1">
                    <Button
                        variant={viewMode === "grid" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setViewMode("grid")}
                    >
                        <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === "list" ? "secondary" : "ghost"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setViewMode("list")}
                    >
                        <ListIcon className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
            ) : (
                <AttachmentList
                    attachments={filteredAttachments}
                    layout={viewMode}
                    onDelete={handleDelete}
                    canDelete={() => true} // In real app, check permissions
                />
            )}
        </div>
    );
}
