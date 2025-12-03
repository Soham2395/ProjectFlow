import { useState, useCallback } from "react";
import { validateFile } from "@/lib/file-utils";

interface UseFileUploadOptions {
    projectId: string;
    taskId?: string;
    commentId?: string;
    onSuccess?: (attachment: any) => void;
    onError?: (error: string) => void;
    maxSizeMB?: number;
}

export function useFileUpload({
    projectId,
    taskId,
    commentId,
    onSuccess,
    onError,
    maxSizeMB = 10,
}: UseFileUploadOptions) {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const uploadFile = useCallback(
        async (file: File) => {
            // Validate file
            const validationError = validateFile(file, maxSizeMB);
            if (validationError) {
                onError?.(validationError);
                return;
            }

            setUploading(true);
            setProgress(0);

            try {
                const signatureRes = await fetch("/api/upload/signature", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folder: `projects/${projectId}` }),
                });

                if (!signatureRes.ok) throw new Error("Failed to get upload signature");

                const { signature, timestamp, cloudName, apiKey, folder } = await signatureRes.json();

                const formData = new FormData();
                formData.append("file", file);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp.toString());
                formData.append("signature", signature);
                formData.append("folder", folder);

                const xhr = new XMLHttpRequest();

                const uploadPromise = new Promise<any>((resolve, reject) => {
                    xhr.upload.addEventListener("progress", (event) => {
                        if (event.lengthComputable) {
                            const percentComplete = Math.round((event.loaded / event.total) * 100);
                            setProgress(percentComplete);
                        }
                    });

                    xhr.addEventListener("load", () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resolve(JSON.parse(xhr.responseText));
                        } else {
                            console.error("Cloudinary error response:", xhr.responseText);
                            reject(new Error(`Cloudinary upload failed: ${xhr.status}`));
                        }
                    });

                    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
                    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));

                    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/upload`);
                    xhr.send(formData);
                });

                const cloudinaryData = await uploadPromise;

                const createRes = await fetch("/api/attachments/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        projectId,
                        taskId,
                        commentId,
                        url: cloudinaryData.secure_url,
                        fileName: file.name,
                        fileType: file.type || cloudinaryData.resource_type,
                        fileSize: file.size,
                        publicId: cloudinaryData.public_id,
                    }),
                });

                if (!createRes.ok) throw new Error("Failed to save attachment metadata");

                const attachment = await createRes.json();
                onSuccess?.(attachment);
            } catch (error: any) {
                console.error("Upload error:", error);
                onError?.(error.message || "Upload failed");
            } finally {
                setUploading(false);
                setProgress(0);
            }
        },
        [projectId, taskId, commentId, maxSizeMB, onSuccess, onError]
    );

    return {
        uploadFile,
        uploading,
        progress,
    };
}
