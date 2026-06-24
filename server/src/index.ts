import express from "express";
import { createServer } from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { setupSocket } from "./socket.js";

import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import templateRoutes from "./routes/templates.js";
import moduleRoutes from "./routes/modules.js";
import aiRoutes from "./routes/ai.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

setupSocket(httpServer);

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/templates", moduleRoutes);
app.use("/api/ai", aiRoutes);


// Serve frontend in production
const distPath = path.resolve(__dirname, "../../dist");
app.use(express.static(distPath));
app.get("*", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

httpServer.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
