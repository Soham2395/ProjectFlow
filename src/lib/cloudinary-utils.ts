export const getThumbnailUrl = (url: string, width: number = 200, height: number = 200): string => {
    if (!url || !url.includes("cloudinary.com")) return url;

    const parts = url.split("/upload/");
    if (parts.length !== 2) return url;

    return `${parts[0]}/upload/c_fill,w_${width},h_${height},q_auto,f_auto/${parts[1]}`;
};

export const getPreviewUrl = (url: string): string => {
    if (!url || !url.includes("cloudinary.com")) return url;

    if (url.endsWith(".pdf")) {
        return url.replace(".pdf", ".jpg");
    }

    return url;
};

export const isImage = (fileType?: string, url?: string): boolean => {
    if (fileType) return fileType.startsWith("image/");
    if (url) return /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
    return false;
};
