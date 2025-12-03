"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Download, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isImage } from "@/lib/cloudinary-utils";

interface FileViewerProps {
    url: string;
    fileName: string;
    fileType: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function FileViewer({ url, fileName, fileType, open, onOpenChange }: FileViewerProps) {
    const [zoom, setZoom] = useState(100);
    const isImg = isImage(fileType, url);
    const isPdf = fileType === "application/pdf" || url.endsWith(".pdf");
    const isVideo = fileType.startsWith("video/");
    const isAudio = fileType.startsWith("audio/");

    const isOfficeDoc =
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || // docx
        fileType === "application/msword" || // doc
        fileType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // xlsx
        fileType === "application/vnd.ms-excel" || // xls
        fileType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || // pptx
        fileType === "application/vnd.ms-powerpoint" || // ppt
        url.endsWith(".docx") || url.endsWith(".doc") ||
        url.endsWith(".xlsx") || url.endsWith(".xls") ||
        url.endsWith(".pptx") || url.endsWith(".ppt");

    const handleDownload = () => {
        window.open(url, "_blank");
    };

    const renderContent = () => {
        if (isImg) {
            return (
                <div className="relative flex h-full w-full items-center justify-center overflow-auto bg-black/5 dark:bg-black/20">
                    <div style={{ transform: `scale(${zoom / 100})`, transition: "transform 0.2s" }}>
                        <Image
                            src={url}
                            alt={fileName}
                            width={1200}
                            height={800}
                            className="max-h-[80vh] w-auto object-contain"
                            unoptimized
                        />
                    </div>
                </div>
            );
        }

        if (isPdf) {
            return (
                <iframe
                    src={url}
                    className="h-[80vh] w-full rounded-md border-0"
                    title={fileName}
                />
            );
        }

        if (isOfficeDoc) {
            const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
            return (
                <iframe
                    src={viewerUrl}
                    className="h-[80vh] w-full rounded-md border-0"
                    title={fileName}
                />
            );
        }

        if (isVideo) {
            return (
                <div className="flex h-full w-full items-center justify-center bg-black">
                    <video controls className="max-h-[80vh] max-w-full">
                        <source src={url} type={fileType} />
                        Your browser does not support the video tag.
                    </video>
                </div>
            );
        }

        if (isAudio) {
            return (
                <div className="flex h-full w-full items-center justify-center p-8">
                    <audio controls className="w-full max-w-md">
                        <source src={url} type={fileType} />
                        Your browser does not support the audio tag.
                    </audio>
                </div>
            );
        }

        return (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="rounded-full bg-muted p-4">
                    <ExternalLink className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">{fileName}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                        This file type cannot be previewed in the browser.
                    </p>
                </div>
                <Button onClick={handleDownload}>
                    <Download className="mr-2 h-4 w-4" />
                    Download File
                </Button>
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl p-0">
                <DialogTitle className="sr-only">{fileName}</DialogTitle>
                <DialogDescription className="sr-only">
                    File viewer for {fileName}
                </DialogDescription>

                {/* Header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                    <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold">{fileName}</h2>
                        <p className="text-xs text-muted-foreground">{fileType}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isImg && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setZoom(Math.max(25, zoom - 25))}
                                    disabled={zoom <= 25}
                                >
                                    <ZoomOut className="h-4 w-4" />
                                </Button>
                                <span className="min-w-[3rem] text-center text-xs text-muted-foreground">
                                    {zoom}%
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                                    disabled={zoom >= 200}
                                >
                                    <ZoomIn className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={handleDownload}
                        >
                            <Download className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="min-h-[60vh]">{renderContent()}</div>
            </DialogContent>
        </Dialog>
    );
}
