import { Server as HTTPServer } from "http";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { config } from "./config.js";
import type { JwtPayload } from "./middleware/auth.js";

let io: Server;

export function setupSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigin,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      next(new Error("Kein Token"));
      return;
    }
    try {
      const payload = jwt.verify(token as string, config.jwt.secret) as JwtPayload;
      (socket as any).user = payload;
      next();
    } catch {
      next(new Error("Ungültiges Token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user as JwtPayload;
    console.log(`Socket connected: ${user.username} (${user.role})`);
    socket.join("authenticated");

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${user.username}`);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

export function emitTemplateEvent(event: string, data: unknown): void {
  if (io) {
    io.to("authenticated").emit(event, data);
  }
}
