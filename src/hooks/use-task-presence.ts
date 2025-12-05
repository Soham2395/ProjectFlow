import { useEffect, useState, useCallback } from 'react';
import { getSocket } from '@/lib/socket-client';
import type { TaskPresenceUpdatePayload } from '@/types/presence';

interface UseTaskPresenceOptions {
    taskId: string;
    projectId: string;
    userId: string;
    userName: string | null;
    userImage: string | null;
    enabled?: boolean;
}

interface PresenceUser {
    userId: string;
    userName: string | null;
    userImage: string | null;
}

export function useTaskPresence({
    taskId,
    projectId,
    userId,
    userName,
    userImage,
    enabled = true,
}: UseTaskPresenceOptions) {
    const [viewers, setViewers] = useState<PresenceUser[]>([]);
    const [editors, setEditors] = useState<PresenceUser[]>([]);
    const [isEditing, setIsEditing] = useState(false);

    const joinTask = useCallback(() => {
        if (!enabled || !taskId || !userId) return;

        const socket = getSocket();

        socket.emit('user:view_task', {
            userId,
            userName,
            userImage,
            projectId,
            taskId,
        });
    }, [taskId, projectId, userId, userName, userImage, enabled]);

    const leaveTask = useCallback(() => {
        // Task presence is automatically cleaned up on socket disconnect
        // or when user navigates away
    }, []);

    const startEditing = useCallback(() => {
        if (!enabled || !taskId || !userId) return;

        const socket = getSocket();
        socket.emit('user:editing', {
            userId,
            userName,
            userImage,
            projectId,
            taskId,
            isEditing: true,
        });
        setIsEditing(true);
    }, [taskId, projectId, userId, userName, userImage, enabled]);

    const stopEditing = useCallback(() => {
        if (!enabled || !taskId || !userId) return;

        const socket = getSocket();
        socket.emit('user:editing', {
            userId,
            userName,
            userImage,
            projectId,
            taskId,
            isEditing: false,
        });
        setIsEditing(false);
    }, [taskId, projectId, userId, userName, userImage, enabled]);

    useEffect(() => {
        if (!enabled) return;

        const socket = getSocket();

        // Listen for task presence updates
        const handleTaskPresenceUpdate = (payload: TaskPresenceUpdatePayload) => {
            if (payload.taskId === taskId) {
                setViewers(payload.viewers);
                setEditors(payload.editors);
            }
        };

        socket.on('presence:task_update', handleTaskPresenceUpdate);

        // Join task on mount
        joinTask();

        return () => {
            socket.off('presence:task_update', handleTaskPresenceUpdate);
            // Stop editing if we were editing
            if (isEditing) {
                stopEditing();
            }
            leaveTask();
        };
    }, [taskId, userId, enabled, joinTask, leaveTask, isEditing, stopEditing]);

    // Filter out current user
    const otherViewers = viewers.filter((v) => v.userId !== userId);
    const otherEditors = editors.filter((e) => e.userId !== userId);

    return {
        viewers,
        otherViewers,
        editors,
        otherEditors,
        isEditing,
        startEditing,
        stopEditing,
        joinTask,
        leaveTask,
    };
}
