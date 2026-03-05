import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./types/env";
import { onError } from "./lib/errors";
import { dbMiddleware } from "./middleware/db";
import { authMiddleware } from "./middleware/auth";
import authRoutes from "./routes/auth";
import providerRoutes from "./routes/providers";
import examRoutes from "./routes/exams";
import questionRoutes from "./routes/questions";
import bookmarkRoutes from "./routes/bookmarks";
import progressRoutes from "./routes/progress";
import sessionRoutes from "./routes/exam-sessions";
import adminRoutes from "./routes/admin";

const app = new Hono<AppEnv>();

app.onError(onError);

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Cf-Access-Jwt-Assertion", "X-Dev-User-Email"],
    credentials: true,
  })
);

app.get("/health", (c) => c.json({ status: "ok" }));

// All /api/v1/* routes require DB + auth
const api = new Hono<AppEnv>();
api.use("*", dbMiddleware, authMiddleware);
api.route("/auth", authRoutes);
api.route("/providers", providerRoutes);
api.route("/exams", examRoutes);
api.route("/", questionRoutes); // mounts /exams/:examId/questions and /questions/:id
api.route("/", bookmarkRoutes); // mounts /questions/:id/bookmark and /bookmarks
api.route("/", progressRoutes); // mounts /exams/:examId/progress
api.route("/exam-sessions", sessionRoutes);
api.route("/admin", adminRoutes);

app.route("/api/v1", api);

export default app;
