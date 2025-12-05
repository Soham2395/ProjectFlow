import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pencil } from 'lucide-react';

interface PresenceUser {
    userId: string;
    userName: string | null;
    userImage: string | null;
}

interface EditingIndicatorProps {
    editor: PresenceUser | null;
    className?: string;
}

export function EditingIndicator({ editor, className = '' }: EditingIndicatorProps) {
    if (!editor) return null;

    return (
        <div
            className={`flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950 ${className}`}
        >
            <Avatar className="h-6 w-6">
                <AvatarImage src={editor.userImage || undefined} alt={editor.userName || 'User'} />
                <AvatarFallback className="text-xs">
                    {editor.userName?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
            </Avatar>
            <div className="flex items-center gap-1.5">
                <Pencil className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {editor.userName || 'Someone'} is editing
                </span>
            </div>
        </div>
    );
}
