import type { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer, Socket } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import { prisma } from '@/lib/prisma';
import { createActivity } from '@/lib/notifications';

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

      socket.on('disconnect', () => {
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}
