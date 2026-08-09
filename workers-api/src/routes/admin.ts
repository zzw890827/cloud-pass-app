import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { adminMiddleware } from "../middleware/auth";
import { importPayloadSchema, normalizeImportPayload } from "../schemas/import";
import { importQuestions } from "../services/import-service";
import { deleteExam } from "../services/exam-delete-service";
import {
  getQuestionWeightsPage,
  updateQuestionWeight,
} from "../services/question-admin-service";
import { AppError } from "../lib/errors";

const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("*", adminMiddleware);

// POST /admin/import
adminRoutes.post("/import", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();

  const normalized = normalizeImportPayload(body);
  const parsed = importPayloadSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new AppError(422, `Validation error: ${parsed.error.message}`);
  }

  const result = await importQuestions(db, parsed.data);
  return c.json(result, 201);
});

// DELETE /admin/exams/:id — delete an exam and all its related data (provider kept)
adminRoutes.delete("/exams/:id", async (c) => {
  const db = c.get("db");
  const examId = Number(c.req.param("id"));
  if (!Number.isInteger(examId)) {
    throw new AppError(400, "Invalid exam id");
  }

  const result = await deleteExam(db, examId);
  return c.json(result, 200);
});

// GET /admin/exams/:id/questions?page=&per_page=
adminRoutes.get("/exams/:id/questions", async (c) => {
  const db = c.get("db");
  const examId = Number(c.req.param("id"));
  if (!Number.isInteger(examId)) throw new AppError(400, "Invalid exam id");

  const page = Number(c.req.query("page") || "1");
  const perPage = Number(c.req.query("per_page") || "50");
  if (!Number.isInteger(page) || !Number.isInteger(perPage)) {
    throw new AppError(400, "page and per_page must be integers");
  }

  const result = await getQuestionWeightsPage(db, examId, page, perPage);
  return c.json(result);
});

// PATCH /admin/questions/:id — draw weight only
adminRoutes.patch("/questions/:id", async (c) => {
  const db = c.get("db");
  const questionId = Number(c.req.param("id"));
  if (!Number.isInteger(questionId)) throw new AppError(400, "Invalid question id");

  const body = await c.req
    .json<{ weight?: unknown }>()
    .catch(() => {
      throw new AppError(400, "Invalid JSON body");
    });
  if (!body || typeof body !== "object" || typeof body.weight !== "number") {
    throw new AppError(400, "weight is required");
  }

  const result = await updateQuestionWeight(db, questionId, body.weight);
  return c.json(result);
});

export default adminRoutes;
