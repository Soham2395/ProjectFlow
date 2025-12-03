import { useState, useRef } from "react";
import { Paperclip, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFileUpload } from "@/lib/hooks/use-file-upload";
import { cn } from "@/lib/utils";

interface CommentAttachmentProps {
    projectId: string;
    taskId: string;
    onUploadComplete: (attachment: any) => void;
    disabled?: boolean;
}

export function CommentAttachment({
    projectId,
    taskId,
    onUploadComplete,
    disabled
}: CommentAttachmentProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const { uploadFile, uploading } = useFileUpload({
        projectId,
        taskId,
        onSuccess: onUploadComplete,
        onError: (err) => console.error("Upload failed:", err), 
    });

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={handleChange}
                disabled={disabled || uploading}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", uploading && "opacity-50")}
                onClick={handleClick}
                disabled={disabled || uploading}
            >
                {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <Paperclip className="h-4 w-4" />
                )}
                <span className="sr-only">Attach file</span>
            </Button>
        </>
    );
}
