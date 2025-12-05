// Real-time presence types for collaborative features

export interface UserPresence {
    userId: string;
    userName: string | null;
    userImage: string | null;
    socketId: string;
    lastSeen: number;
}

export interface ProjectPresence {
    projectId: string;
    users: Map<string, Set<string>>; // userId -> Set of socketIds
}

export interface TaskPresence {
    taskId: string;
    viewers: Set<string>; // userIds viewing the task
    editors: Set<string>; // userIds editing the task
}

export interface TypingState {
    userId: string;
    userName: string | null;
    context: 'comment' | 'chat' | 'description';
    lastTypedAt: number;
}

// Client → Server event payloads
export interface UserJoinPayload {
    userId: string;
    userName: string | null;
    userImage: string | null;
    projectId?: string;
    taskId?: string;
}

export interface ViewProjectPayload {
    userId: string;
    userName: string | null;
    userImage: string | null;
    projectId: string;
}

export interface ViewTaskPayload {
    userId: string;
    userName: string | null;
    userImage: string | null;
    projectId: string;
    taskId: string;
}

export interface TypingPayload {
    userId: string;
    userName: string | null;
    projectId: string;
    taskId?: string;
    context: 'comment' | 'chat' | 'description';
}

export interface EditingPayload {
    userId: string;
    userName: string | null;
    userImage: string | null;
    projectId: string;
    taskId: string;
    isEditing: boolean;
}

// Server → Client event payloads
export interface PresenceUpdatePayload {
    projectId: string;
    users: Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
        socketCount: number;
    }>;
}

export interface TaskPresenceUpdatePayload {
    taskId: string;
    viewers: Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
    }>;
    editors: Array<{
        userId: string;
        userName: string | null;
        userImage: string | null;
    }>;
}

export interface TypingUpdatePayload {
    taskId?: string;
    projectId: string;
    typingUsers: Array<{
        userId: string;
        userName: string | null;
        context: 'comment' | 'chat' | 'description';
    }>;
}

export interface EditingUpdatePayload {
    taskId: string;
    projectId: string;
    editor: {
        userId: string;
        userName: string | null;
        userImage: string | null;
    } | null;
}

// Socket event map for type safety
export interface ServerToClientEvents {
    'presence:project_update': (payload: PresenceUpdatePayload) => void;
    'presence:task_update': (payload: TaskPresenceUpdatePayload) => void;
    'presence:typing': (payload: TypingUpdatePayload) => void;
    'presence:editing': (payload: EditingUpdatePayload) => void;
    // Existing events
    message: (message: any) => void;
    history: (messages: any[]) => void;
    typing: (payload: { userId: string; isTyping: boolean }) => void;
}

export interface ClientToServerEvents {
    'user:join': (payload: UserJoinPayload) => void;
    'user:view_project': (payload: ViewProjectPayload) => void;
    'user:view_task': (payload: ViewTaskPayload) => void;
    'user:typing': (payload: TypingPayload) => void;
    'user:editing': (payload: EditingPayload) => void;
    // Existing events
    joinRoom: (projectId: string) => void;
    joinUser: (userId: string) => void;
    sendMessage: (payload: any) => void;
    typing: (payload: { projectId: string; userId: string; isTyping: boolean }) => void;
}
