import { useState } from "react";
import Image from "next/image";
import {
    FileText,
    File,
    FileSpreadsheet,
    FileCode,
    FileArchive,
    Video,
    Music,
    ExternalLink,
    Eye
} from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { getFileIcon } from "@/lib/file-utils";
import { getThumbnailUrl, getPreviewUrl, isImage } from "@/lib/cloudinary-utils";

interface FilePreviewProps {
    url: string;
    fileName: string;
    fileType: string;
    className?: string;
    showPreview?: boolean;
}

export function FilePreview({
    url,
    fileName,
    fileType,
    className = "",
    showPreview = true
}: FilePreviewProps) {
    const [isOpen, setIsOpen] = useState(false);
    const isImg = isImage(fileType, url);
    const iconType = getFileIcon(fileType);

    const renderIcon = () => {
        switch (iconType) {
            case "image": return <File className="h-8 w-8 text-blue-500" />; // Fallback if image fails
            case "pdf": return <FileText className="h-8 w-8 text-red-500" />;
            case "doc": return <FileText className="h-8 w-8 text-blue-600" />;
            case "xls": return <FileSpreadsheet className="h-8 w-8 text-green-600" />;
            case "zip": return <FileArchive className="h-8 w-8 text-yellow-600" />;
            case "video": return <Video className="h-8 w-8 text-purple-600" />;
            case "audio": return <Music className="h-8 w-8 text-pink-600" />;
            default: return <File className="h-8 w-8 text-gray-500" />;
        }
    };

    if (isImg && showPreview) {
        return (
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                    <div className={`relative group cursor-pointer overflow-hidden rounded-md border bg-muted ${className}`}>
                        <Image
                            src={getThumbnailUrl(url, 300, 300)}
                            alt={fileName}
                            width={300}
                            height={300}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <Eye className="h-6 w-6 text-white" />
                        </div>
                    </div>
                </DialogTrigger>
                <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none">
                    <div className="relative h-[80vh] w-full">
                        <Image
                            src={url}
                            alt={fileName}
                            fill
                            className="object-contain"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <div className={`flex items-center justify-center rounded-md border bg-muted p-2 ${className}`}>
            {renderIcon()}
        </div>
    );
}
