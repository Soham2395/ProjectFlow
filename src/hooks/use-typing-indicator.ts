import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket } from '@/lib/socket-client';
import type { TypingUpdatePayload } from '@/types/presence';

interface UseTypingIndicatorOptions {
    projectId: string;
    taskId?: string;
    userId: string;
    userName: string | null;
    context: 'comment' | 'chat' | 'description';
    enabled?: boolean;
    throttleMs?: number;
}

interface TypingUser {
    userId: string;
    userName: string | null;
    context: 'comment' | 'chat' | 'description';
}

export function useTypingIndicator({
    projectId,
    taskId,
    userId,
    userName,
    context,
    enabled = true,
    throttleMs = 500,
}: UseTypingIndicatorOptions) {
    const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
    const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastEmitTimeRef = useRef<number>(0);

    const emitTyping = useCallback(() => {
        if (!enabled || !userId) return;

        const now = Date.now();
        const timeSinceLastEmit = now - lastEmitTimeRef.current;

        const doEmit = () => {
            const socket = getSocket();
            socket.emit('user:typing', {
                userId,
                userName,
                projectId,
                taskId,
                context,
            });
            lastEmitTimeRef.current = Date.now();
        };

        // If enough time has passed, emit immediately
        if (timeSinceLastEmit >= throttleMs) {
            doEmit();
        } else {
            // Otherwise, schedule for later (throttle)
            if (throttleTimerRef.current) {
                clearTimeout(throttleTimerRef.current);
            }
            throttleTimerRef.current = setTimeout(() => {
                doEmit();
            }, throttleMs - timeSinceLastEmit);
        }
    }, [projectId, taskId, userId, userName, context, enabled, throttleMs]);

    const stopTyping = useCallback(() => {
        if (throttleTimerRef.current) {
            clearTimeout(throttleTimerRef.current);
            throttleTimerRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;

        const socket = getSocket();

        // Listen for typing updates
        const handleTypingUpdate = (payload: TypingUpdatePayload) => {
            // Match by taskId if provided, otherwise by projectId
            const matches = taskId
                ? payload.taskId === taskId
                : payload.projectId === projectId && !payload.taskId;

            if (matches) {
                // Filter to same context and exclude current user
                const relevantTypingUsers = payload.typingUsers.filter(
                    (u) => u.context === context && u.userId !== userId
                );
                setTypingUsers(relevantTypingUsers);
            }
        };

        socket.on('presence:typing', handleTypingUpdate);

        return () => {
            socket.off('presence:typing', handleTypingUpdate);
            stopTyping();
        };
    }, [projectId, taskId, userId, context, enabled, stopTyping]);

    // Format typing message
    const typingMessage = (() => {
        if (typingUsers.length === 0) return null;
        if (typingUsers.length === 1) {
            return `${typingUsers[0].userName || 'Someone'} is typing...`;
        }
        if (typingUsers.length === 2) {
            return `${typingUsers[0].userName || 'Someone'} and ${typingUsers[1].userName || 'someone'} are typing...`;
        }
        return `${typingUsers[0].userName || 'Someone'} and ${typingUsers.length - 1} others are typing...`;
    })();

    return {
        typingUsers,
        typingMessage,
        emitTyping,
        stopTyping,
        isAnyoneTyping: typingUsers.length > 0,
    };
}
