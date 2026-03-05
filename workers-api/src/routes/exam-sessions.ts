import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { AppError } from "../lib/errors";
import {
  createSession,
  getSession,
  getActiveSession,
  getSessionQuestion,
  submitSessionAnswer,
  completeSession,
  abandonSession,
  getSessionResult,
  getSessionHistory,
  getErrorReport,
} from "../services/exam-session-service";

const sessionRoutes = new Hono<AppEnv>();

function requireExamIdQuery(c: { req: { query: (k: string) => string | undefined } }): number {
  const raw = c.req.query("exam_id");
  const id = Number(raw);
  if (!raw || isNaN(id)) throw new AppError(400, "exam_id query parameter is required");
  return id;
}

// POST /exam-sessions
sessionRoutes.post("/", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const body = await c.req.json<{ exam_id: number }>();
  if (!body.exam_id || typeof body.exam_id !== "number") {
    throw new AppError(400, "exam_id is required");
  }

  const result = await createSession(db, user.id, body.exam_id);
  return c.json(result, 201);
});

// GET /exam-sessions/active?exam_id=X
sessionRoutes.get("/active", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = requireExamIdQuery(c);

  const result = await getActiveSession(db, user.id, examId);
  return c.json(result);
});

// GET /exam-sessions/history?exam_id=X
sessionRoutes.get("/history", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = requireExamIdQuery(c);

  const result = await getSessionHistory(db, user.id, examId);
  return c.json(result);
});

// GET /exam-sessions/error-report?exam_id=X
sessionRoutes.get("/error-report", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = requireExamIdQuery(c);

  const result = await getErrorReport(db, user.id, examId);
  return c.json(result);
});

// GET /exam-sessions/:id
sessionRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));

  const result = await getSession(db, sessionId, user.id);
  return c.json(result);
});

// GET /exam-sessions/:id/result
sessionRoutes.get("/:id/result", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));

  const result = await getSessionResult(db, sessionId, user.id);
  return c.json(result);
});

// GET /exam-sessions/:id/questions/:orderIndex
sessionRoutes.get("/:id/questions/:orderIndex", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));
  const orderIndex = Number(c.req.param("orderIndex"));

  const result = await getSessionQuestion(db, sessionId, orderIndex, user.id);
  return c.json(result);
});

// POST /exam-sessions/:id/questions/:orderIndex/submit
sessionRoutes.post("/:id/questions/:orderIndex/submit", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));
  const orderIndex = Number(c.req.param("orderIndex"));
  const body = await c.req.json<{ selected_option_ids: number[] }>();
  if (!Array.isArray(body.selected_option_ids)) {
    throw new AppError(400, "selected_option_ids must be an array");
  }

  const result = await submitSessionAnswer(db, sessionId, orderIndex, user.id, body.selected_option_ids);
  return c.json(result);
});

// POST /exam-sessions/:id/complete
sessionRoutes.post("/:id/complete", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));

  const result = await completeSession(db, sessionId, user.id);
  return c.json(result);
});

// POST /exam-sessions/:id/abandon
sessionRoutes.post("/:id/abandon", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const sessionId = Number(c.req.param("id"));

  await abandonSession(db, sessionId, user.id);
  return c.body(null, 204);
});

export default sessionRoutes;
