import type { Server as IOServer } from 'socket.io';

// Expose a global Socket.IO server instance created in pages/api/socket.ts
// so that API routes in the App Router can emit events.
// pages/api/socket.ts should set globalThis.__io = io

declare global {
  // eslint-disable-next-line no-var
  var __io: IOServer | undefined;
}

export function getIO(): IOServer | null {
  return globalThis.__io ?? null;
}
