import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { getProgressDetail, resetProgress } from "../services/progress-service";

const progressRoutes = new Hono<AppEnv>();

// GET /exams/:examId/progress
progressRoutes.get("/exams/:examId/progress", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("examId"));

  const result = await getProgressDetail(db, examId, user.id);
  return c.json(result);
});

// DELETE /exams/:examId/progress
progressRoutes.delete("/exams/:examId/progress", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("examId"));

  await resetProgress(db, examId, user.id);
  return c.body(null, 204);
});

export default progressRoutes;
