import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { getQuestionsPage, getQuestionDetail, submitAnswer } from "../services/question-service";
import { AppError } from "../lib/errors";

const questionRoutes = new Hono<AppEnv>();

// GET /exams/:examId/questions — paginated list
questionRoutes.get("/exams/:examId/questions", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("examId"));
  const page = Number(c.req.query("page") || "1");
  const perPage = Number(c.req.query("per_page") || "50");

  const result = await getQuestionsPage(db, examId, user.id, page, perPage);
  return c.json(result);
});

// GET /questions/:id — detail (no is_correct in options)
questionRoutes.get("/questions/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const questionId = Number(c.req.param("id"));

  const result = await getQuestionDetail(db, questionId, user.id);
  return c.json(result);
});

// POST /questions/:id/submit — submit answer, upsert progress, reveal answers
questionRoutes.post("/questions/:id/submit", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const questionId = Number(c.req.param("id"));
  const body = await c.req.json<{ selected_option_ids: number[] }>();
  if (!Array.isArray(body.selected_option_ids)) {
    throw new AppError(400, "selected_option_ids must be an array");
  }

  const result = await submitAnswer(db, questionId, user.id, body.selected_option_ids);
  return c.json(result);
});

export default questionRoutes;
