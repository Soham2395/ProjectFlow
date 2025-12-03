import { useState } from "react";
import { format } from "date-fns";
import { Download, Trash2, MoreVertical, FileText, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FilePreview } from "./file-preview";
import { FileViewer } from "./file-viewer";
import { formatFileSize } from "@/lib/file-utils";

interface Attachment {
    id: string;
    url: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    createdAt: string;
    uploadedBy: string;
    user: {
        id: string;
        name: string | null;
        image: string | null;
    };
}

interface AttachmentListProps {
    attachments: Attachment[];
    onDelete?: (id: string) => Promise<void>;
    canDelete?: (attachment: Attachment) => boolean;
    layout?: "grid" | "list";
}

export function AttachmentList({
    attachments,
    onDelete,
    canDelete,
    layout = "list"
}: AttachmentListProps) {
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [viewingFile, setViewingFile] = useState<Attachment | null>(null);

    const handleDelete = async () => {
        if (!deleteId || !onDelete) return;

        setIsDeleting(true);
        try {
            await onDelete(deleteId);
        } finally {
            setIsDeleting(false);
            setDeleteId(null);
        }
    };

    if (attachments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <FileText className="mb-2 h-8 w-8 opacity-20" />
                <p className="text-sm">No attachments yet</p>
            </div>
        );
    }

    if (layout === "grid") {
        return (
            <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                    {attachments.map((attachment) => (
                        <div key={attachment.id} className="group relative flex flex-col gap-2">
                            <FilePreview
                                url={attachment.url}
                                fileName={attachment.fileName}
                                fileType={attachment.fileType}
                                className="aspect-square w-full"
                            />
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-xs font-medium" title={attachment.fileName}>
                                        {attachment.fileName}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {formatFileSize(attachment.fileSize)}
                                    </p>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                            <MoreVertical className="h-3 w-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setViewingFile(attachment)}>
                                            <Eye className="mr-2 h-4 w-4" />
                                            View
                                        </DropdownMenuItem>
                                        <DropdownMenuItem asChild>
                                            <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                                                <Download className="mr-2 h-4 w-4" />
                                                Download
                                            </a>
                                        </DropdownMenuItem>
                                        {onDelete && canDelete?.(attachment) && (
                                            <DropdownMenuItem
                                                className="text-destructive focus:text-destructive"
                                                onClick={() => setDeleteId(attachment.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    ))}
                </div>

                {viewingFile && (
                    <FileViewer
                        url={viewingFile.url}
                        fileName={viewingFile.fileName}
                        fileType={viewingFile.fileType}
                        open={!!viewingFile}
                        onOpenChange={(open) => !open && setViewingFile(null)}
                    />
                )}

                <DeleteConfirmation
                    open={!!deleteId}
                    onOpenChange={(open) => !open && setDeleteId(null)}
                    onConfirm={handleDelete}
                    isDeleting={isDeleting}
                />
            </>
        );
    }

    return (
        <>
            <div className="space-y-2">
                {attachments.map((attachment) => (
                    <div
                        key={attachment.id}
                        className="flex items-center gap-3 rounded-md border p-2 hover:bg-accent/50"
                    >
                        <FilePreview
                            url={attachment.url}
                            fileName={attachment.fileName}
                            fileType={attachment.fileType}
                            className="h-10 w-10 shrink-0"
                            showPreview={false}
                        />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium">{attachment.fileName}</p>
                                <span className="text-xs text-muted-foreground">
                                    {formatFileSize(attachment.fileSize)}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{attachment.user.name}</span>
                                <span>•</span>
                                <span>{format(new Date(attachment.createdAt), "MMM d, yyyy")}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setViewingFile(attachment)}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                <a href={attachment.url} download target="_blank" rel="noopener noreferrer">
                                    <Download className="h-4 w-4" />
                                </a>
                            </Button>
                            {onDelete && canDelete?.(attachment) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteId(attachment.id)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {viewingFile && (
                <FileViewer
                    url={viewingFile.url}
                    fileName={viewingFile.fileName}
                    fileType={viewingFile.fileType}
                    open={!!viewingFile}
                    onOpenChange={(open) => !open && setViewingFile(null)}
                />
            )}

            <DeleteConfirmation
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />
        </>
    );
}

function DeleteConfirmation({
    open,
    onOpenChange,
    onConfirm,
    isDeleting
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete attachment?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the file.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isDeleting ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
