import { useRef, useState } from "react";
import { Upload, X, File as FileIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/file-utils";

interface FileUploadProps {
    projectId: string;
    taskId?: string;
    commentId?: string;
    onUploadComplete?: (attachment: any) => void;
    className?: string;
    maxSizeMB?: number;
}

export function FileUpload({
    projectId,
    taskId,
    commentId,
    onUploadComplete,
    className,
    maxSizeMB = 10,
}: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const { uploadFile, uploading, progress } = useFileUpload({
        projectId,
        taskId,
        commentId,
        maxSizeMB,
        onSuccess: (attachment) => {
            onUploadComplete?.(attachment);
            setError(null);
        },
        onError: (err) => setError(err),
    });

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            uploadFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
        // Reset input so same file can be selected again if needed
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    const onButtonClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className={cn("w-full", className)}>
            <div
                className={cn(
                    "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
                    dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                    uploading ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-muted/50"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
            >
                <input
                    ref={inputRef}
                    type="file"
                    className="hidden"
                    onChange={handleChange}
                    disabled={uploading}
                />

                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-center w-full max-w-xs">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="text-sm font-medium">Uploading...</p>
                        <Progress value={progress} className="h-2 w-full" />
                        <p className="text-xs text-muted-foreground">{progress}%</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                        <div className="rounded-full bg-muted p-2">
                            <Upload className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-sm font-medium">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Max file size: {maxSizeMB}MB
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="mt-2 flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                    <X className="h-4 w-4" />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
}
