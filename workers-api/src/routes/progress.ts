import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { getProgressDetail, resetProgress } from "../services/progress-service";
import { assertExamAccess, questionDomainFilterFor } from "../lib/exam-access";

const progressRoutes = new Hono<AppEnv>();

// GET /exams/:examId/progress
progressRoutes.get("/exams/:examId/progress", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("examId"));

  await assertExamAccess(db, examId, user);

  const result = await getProgressDetail(db, examId, user.id, questionDomainFilterFor(user));
  return c.json(result);
});

// DELETE /exams/:examId/progress
progressRoutes.delete("/exams/:examId/progress", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("examId"));

  await assertExamAccess(db, examId, user);

  await resetProgress(db, examId, user.id);
  return c.body(null, 204);
});

export default progressRoutes;
