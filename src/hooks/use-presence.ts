import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket-client';
import type { PresenceUpdatePayload } from '@/types/presence';

interface UsePresenceOptions {
    projectId: string;
    userId: string;
    userName: string | null;
    userImage: string | null;
    enabled?: boolean;
}

interface OnlineUser {
    userId: string;
    userName: string | null;
    userImage: string | null;
    socketCount: number;
}

export function usePresence({
    projectId,
    userId,
    userName,
    userImage,
    enabled = true,
}: UsePresenceOptions) {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    const joinProject = useCallback(() => {
        if (!enabled || !projectId || !userId) return;

        const socket = getSocket();

        // Join user presence
        socket.emit('user:join', {
            userId,
            userName,
            userImage,
            projectId,
        });

        // View project
        socket.emit('user:view_project', {
            userId,
            userName,
            userImage,
            projectId,
        });

        setIsConnected(true);
    }, [projectId, userId, userName, userImage, enabled]);

    const leaveProject = useCallback(() => {
        // Presence is automatically cleaned up on socket disconnect
        // This is just for explicit leaving if needed
        setIsConnected(false);
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const socket = getSocket();

        // Listen for presence updates
        const handlePresenceUpdate = (payload: PresenceUpdatePayload) => {
            if (payload.projectId === projectId) {
                setOnlineUsers(payload.users);
            }
        };

        socket.on('presence:project_update', handlePresenceUpdate);

        // Join project on mount
        joinProject();

        return () => {
            socket.off('presence:project_update', handlePresenceUpdate);
            leaveProject();
        };
    }, [projectId, userId, enabled, joinProject, leaveProject]);

    // Filter out current user from online users
    const otherUsers = onlineUsers.filter((u) => u.userId !== userId);

    return {
        onlineUsers,
        otherUsers,
        isConnected,
        joinProject,
        leaveProject,
    };
}
