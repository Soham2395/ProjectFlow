import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface PresenceUser {
    userId: string;
    userName: string | null;
    userImage: string | null;
}

interface PresenceAvatarsProps {
    users: PresenceUser[];
    maxVisible?: number;
    size?: 'sm' | 'md' | 'lg';
    showOnlineIndicator?: boolean;
    className?: string;
}

export function PresenceAvatars({
    users,
    maxVisible = 3,
    size = 'md',
    showOnlineIndicator = true,
    className = '',
}: PresenceAvatarsProps) {
    const visibleUsers = users.slice(0, maxVisible);
    const remainingCount = users.length - maxVisible;

    const sizeClasses = {
        sm: 'h-6 w-6 text-xs',
        md: 'h-8 w-8 text-sm',
        lg: 'h-10 w-10 text-base',
    };

    const avatarSize = sizeClasses[size];

    if (users.length === 0) return null;

    return (
        <TooltipProvider>
            <div className={`flex items-center ${className}`}>
                <div className="flex -space-x-2">
                    {visibleUsers.map((user, index) => (
                        <Tooltip key={user.userId}>
                            <TooltipTrigger asChild>
                                <div className="relative">
                                    <Avatar
                                        className={`${avatarSize} border-2 border-background ring-2 ring-background`}
                                    >
                                        <AvatarImage src={user.userImage || undefined} alt={user.userName || 'User'} />
                                        <AvatarFallback className="text-xs">
                                            {user.userName?.charAt(0).toUpperCase() || 'U'}
                                        </AvatarFallback>
                                    </Avatar>
                                    {showOnlineIndicator && (
                                        <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-background" />
                                    )}
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p className="text-sm">{user.userName || 'Unknown User'}</p>
                            </TooltipContent>
                        </Tooltip>
                    ))}

                    {remainingCount > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div
                                    className={`${avatarSize} flex items-center justify-center rounded-full border-2 border-background bg-muted ring-2 ring-background`}
                                >
                                    <span className="text-xs font-medium text-muted-foreground">
                                        +{remainingCount}
                                    </span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <div className="max-w-xs">
                                    <p className="mb-1 text-xs font-semibold">Others viewing:</p>
                                    {users.slice(maxVisible).map((user) => (
                                        <p key={user.userId} className="text-xs">
                                            {user.userName || 'Unknown User'}
                                        </p>
                                    ))}
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
