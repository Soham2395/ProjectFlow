import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '@/lib/prisma';
import { createActivity } from '@/lib/notifications';
import type {
  UserJoinPayload,
  ViewProjectPayload,
  ViewTaskPayload,
  TypingPayload,
  EditingPayload,
  PresenceUpdatePayload,
  TaskPresenceUpdatePayload,
  TypingUpdatePayload,
  EditingUpdatePayload,
  ServerToClientEvents,
  ClientToServerEvents,
} from '@/types/presence';

// Augment res.socket.server to include io instance
interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: NextApiResponse['socket'] & { server: SocketServer };
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// In-memory presence storage
interface UserPresenceData {
  userId: string;
  userName: string | null;
  userImage: string | null;
}

// Map of projectId -> userId -> Set<socketId>
const projectPresence = new Map<string, Map<string, Set<string>>>();

// Map of taskId -> { viewers: Map<userId, userData>, editors: Map<userId, userData> }
const taskPresence = new Map<string, {
  viewers: Map<string, UserPresenceData>;
  editors: Map<string, UserPresenceData>;
}>();

// Map of socketId -> { projectIds: Set, taskIds: Set, userId, userName, userImage }
const socketToContext = new Map<string, {
  userId: string;
  userName: string | null;
  userImage: string | null;
  projectIds: Set<string>;
  taskIds: Set<string>;
}>();

// Map of (projectId or taskId) -> userId -> lastTypedAt
const typingStates = new Map<string, Map<string, { userName: string | null; context: string; lastTypedAt: number }>>();

// Typing timeout (3 seconds)
const TYPING_TIMEOUT = 3000;

export default async function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: '/api/socket',
      addTrailingSlash: false,
      cors: { origin: '*' },
    });

    // Expose globally so App Router API handlers can emit
    (globalThis as any).__io = io;

    io.on('connection', (socket: Socket) => {
      socket.on('joinRoom', async (projectId: string) => {
        if (!projectId) return;
        socket.join(projectId);
        try {
          const messages = await prisma.chatMessage.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { sender: true },
          });
          // send history to the joining socket (chronological)
          socket.emit('history', messages.reverse());
        } catch (err) {
          console.error('Error fetching history', err);
        }
      });

      // Allow clients to join their own user notification room
      socket.on('joinUser', (userId: string) => {
        if (!userId) return;
        socket.join(`user:${userId}`);
      });

      // sendMessage: broadcast to room and persist
      socket.on('sendMessage', async (payload: {
        projectId: string;
        senderId: string;
        content?: string | null;
        fileUrl?: string | null;
        fileType?: string | null;
      }) => {
        const { projectId, senderId, content, fileUrl, fileType } = payload || {} as any;
        if (!projectId || !senderId || (!content && !fileUrl)) return;
        try {
          // Get project's organizationId
          const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { organizationId: true },
          });

          if (!project) return;

          const message = await prisma.chatMessage.create({
            data: {
              projectId,
              organizationId: project.organizationId,
              senderId,
              content: content ?? null,
              fileUrl: fileUrl ?? null,
              fileType: fileType ?? null,
            },
            include: { sender: true },
          });
          io.to(projectId).emit('message', message);
          // Emit project activity for chat message
          await createActivity({
            projectId,
            organizationId: project.organizationId,
            actorId: senderId,
            verb: 'commented',
            targetId: null,
            summary: message.content ? `New message from ${message.sender?.name || message.senderId}` : 'New file shared',
            meta: { messageId: message.id, fileUrl: message.fileUrl, fileType: message.fileType },
          });
        } catch (err) {
          console.error('Error creating message', err);
        }
      });

      socket.on('typing', (payload: { projectId: string; userId: string; isTyping: boolean }) => {
        const { projectId, userId, isTyping } = payload || {} as any;
        if (!projectId || !userId) return;
        socket.to(projectId).emit('typing', { userId, isTyping });
      });

      // ========== PRESENCE EVENTS ==========

      // Helper functions for broadcasting presence updates
      const broadcastProjectPresence = (projectId: string) => {
        const projectUsers = projectPresence.get(projectId);
        if (!projectUsers) return;

        const users: PresenceUpdatePayload['users'] = [];
        projectUsers.forEach((socketIds, userId) => {
          const ctx = socketToContext.get([...socketIds][0]);
          if (ctx) {
            users.push({
              userId: ctx.userId,
              userName: ctx.userName,
              userImage: ctx.userImage,
              socketCount: socketIds.size,
            });
          }
        });

        io.to(projectId).emit('presence:project_update', { projectId, users });
      };

      const broadcastTaskPresence = (taskId: string) => {
        const task = taskPresence.get(taskId);
        if (!task) return;

        const viewers = Array.from(task.viewers.values());
        const editors = Array.from(task.editors.values());

        io.to(`task:${taskId}`).emit('presence:task_update', {
          taskId,
          viewers,
          editors,
        });
      };

      // user:join - Initial connection with context
      socket.on('user:join', (payload: UserJoinPayload) => {
        const { userId, userName, userImage, projectId, taskId } = payload;
        if (!userId) return;

        // Track socket context
        socketToContext.set(socket.id, {
          userId,
          userName,
          userImage,
          projectIds: new Set(projectId ? [projectId] : []),
          taskIds: new Set(taskId ? [taskId] : []),
        });

        // Join user's personal notification room
        socket.join(`user:${userId}`);
      });

      // user:view_project - User is viewing a project board
      socket.on('user:view_project', (payload: ViewProjectPayload) => {
        const { userId, userName, userImage, projectId } = payload;
        if (!userId || !projectId) return;

        // Join project room
        socket.join(projectId);

        // Update context
        const ctx = socketToContext.get(socket.id);
        if (ctx) {
          ctx.projectIds.add(projectId);
        }

        // Add to project presence
        if (!projectPresence.has(projectId)) {
          projectPresence.set(projectId, new Map());
        }
        const projectUsers = projectPresence.get(projectId)!;
        if (!projectUsers.has(userId)) {
          projectUsers.set(userId, new Set());
        }
        projectUsers.get(userId)!.add(socket.id);

        // Broadcast update
        broadcastProjectPresence(projectId);
      });

      // user:view_task - User is viewing a specific task
      socket.on('user:view_task', (payload: ViewTaskPayload) => {
        const { userId, userName, userImage, projectId, taskId } = payload;
        if (!userId || !taskId) return;

        // Join task room
        socket.join(`task:${taskId}`);

        // Update context
        const ctx = socketToContext.get(socket.id);
        if (ctx) {
          ctx.taskIds.add(taskId);
        }

        // Add to task viewers
        if (!taskPresence.has(taskId)) {
          taskPresence.set(taskId, {
            viewers: new Map(),
            editors: new Map(),
          });
        }
        const task = taskPresence.get(taskId)!;
        task.viewers.set(userId, { userId, userName, userImage });

        // Broadcast update
        broadcastTaskPresence(taskId);
      });

      // user:typing - User is typing in a comment/description
      socket.on('user:typing', (payload: TypingPayload) => {
        const { userId, userName, projectId, taskId, context } = payload;
        if (!userId || !projectId) return;

        const key = taskId || projectId;

        // Update typing state
        if (!typingStates.has(key)) {
          typingStates.set(key, new Map());
        }
        const typing = typingStates.get(key)!;
        typing.set(userId, { userName, context, lastTypedAt: Date.now() });

        // Broadcast typing update
        const typingUsers = Array.from(typing.entries())
          .filter(([_, data]) => Date.now() - data.lastTypedAt < TYPING_TIMEOUT)
          .map(([uid, data]) => ({
            userId: uid,
            userName: data.userName,
            context: data.context as 'comment' | 'chat' | 'description',
          }));

        const room = taskId ? `task:${taskId}` : projectId;
        io.to(room).emit('presence:typing', {
          taskId,
          projectId,
          typingUsers,
        });

        // Auto-cleanup after timeout
        setTimeout(() => {
          const currentTyping = typingStates.get(key);
          if (currentTyping) {
            const userData = currentTyping.get(userId);
            if (userData && Date.now() - userData.lastTypedAt >= TYPING_TIMEOUT) {
              currentTyping.delete(userId);

              // Broadcast updated typing state
              const updatedTypingUsers = Array.from(currentTyping.entries())
                .filter(([_, data]) => Date.now() - data.lastTypedAt < TYPING_TIMEOUT)
                .map(([uid, data]) => ({
                  userId: uid,
                  userName: data.userName,
                  context: data.context as 'comment' | 'chat' | 'description',
                }));

              io.to(room).emit('presence:typing', {
                taskId,
                projectId,
                typingUsers: updatedTypingUsers,
              });
            }
          }
        }, TYPING_TIMEOUT);
      });

      // user:editing - User is editing a task
      socket.on('user:editing', (payload: EditingPayload) => {
        const { userId, userName, userImage, projectId, taskId, isEditing } = payload;
        if (!userId || !taskId) return;

        const task = taskPresence.get(taskId);
        if (!task) return;

        if (isEditing) {
          task.editors.set(userId, { userId, userName, userImage });
        } else {
          task.editors.delete(userId);
        }

        // Broadcast editing update (only one editor shown, typically the first)
        const editor = task.editors.size > 0 ? Array.from(task.editors.values())[0] : null;
        io.to(`task:${taskId}`).emit('presence:editing', {
          taskId,
          projectId,
          editor,
        });
      });

      socket.on('disconnect', () => {
        // Clean up all presence for this socket
        const ctx = socketToContext.get(socket.id);
        if (!ctx) return;

        const { userId, projectIds, taskIds } = ctx;

        // Remove from project presence
        projectIds.forEach((projectId) => {
          const projectUsers = projectPresence.get(projectId);
          if (projectUsers) {
            const userSockets = projectUsers.get(userId);
            if (userSockets) {
              userSockets.delete(socket.id);
              if (userSockets.size === 0) {
                projectUsers.delete(userId);
              }
              broadcastProjectPresence(projectId);
            }
            if (projectUsers.size === 0) {
              projectPresence.delete(projectId);
            }
          }
        });

        // Remove from task presence
        taskIds.forEach((taskId) => {
          const task = taskPresence.get(taskId);
          if (task) {
            task.viewers.delete(userId);
            task.editors.delete(userId);
            broadcastTaskPresence(taskId);

            if (task.viewers.size === 0 && task.editors.size === 0) {
              taskPresence.delete(taskId);
            }
          }
        });

        // Clean up socket context
        socketToContext.delete(socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
