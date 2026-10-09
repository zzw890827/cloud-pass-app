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
import {
  listUsersWithAccess,
  updateUserFlags,
  setUserExamAccess,
  setUserExamDomains,
  listExamDomains,
  updateExamVisibility,
} from "../services/user-admin-service";
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

// PATCH /admin/exams/:id — exam visibility (public vs. grant-only)
adminRoutes.patch("/exams/:id", async (c) => {
  const db = c.get("db");
  const examId = Number(c.req.param("id"));
  if (!Number.isInteger(examId)) throw new AppError(400, "Invalid exam id");

  const body = await c.req.json<{ is_public?: unknown }>().catch(() => {
    throw new AppError(400, "Invalid JSON body");
  });
  if (!body || typeof body !== "object" || typeof body.is_public !== "boolean") {
    throw new AppError(400, "is_public (boolean) is required");
  }

  const result = await updateExamVisibility(db, examId, body.is_public);
  return c.json(result);
});

// GET /admin/users — every user with their exam grants
adminRoutes.get("/users", async (c) => {
  const db = c.get("db");
  return c.json(await listUsersWithAccess(db));
});

// GET /admin/exam-domains — every exam's domains (for the domain pickers)
adminRoutes.get("/exam-domains", async (c) => {
  const db = c.get("db");
  return c.json(await listExamDomains(db));
});

// PATCH /admin/users/:id — is_active / is_admin / can_use_exam_mode
adminRoutes.patch("/users/:id", async (c) => {
  const db = c.get("db");
  const actingUser = c.get("user");
  const userId = Number(c.req.param("id"));
  if (!Number.isInteger(userId)) throw new AppError(400, "Invalid user id");

  const body = await c.req
    .json<{ is_active?: unknown; is_admin?: unknown; can_use_exam_mode?: unknown }>()
    .catch(() => {
      throw new AppError(400, "Invalid JSON body");
    });
  if (!body || typeof body !== "object") {
    throw new AppError(400, "Invalid JSON body");
  }
  if (body.is_active !== undefined && typeof body.is_active !== "boolean") {
    throw new AppError(400, "is_active must be a boolean");
  }
  if (body.is_admin !== undefined && typeof body.is_admin !== "boolean") {
    throw new AppError(400, "is_admin must be a boolean");
  }
  if (body.can_use_exam_mode !== undefined && typeof body.can_use_exam_mode !== "boolean") {
    throw new AppError(400, "can_use_exam_mode must be a boolean");
  }

  const result = await updateUserFlags(db, userId, actingUser.id, {
    isActive: body.is_active as boolean | undefined,
    isAdmin: body.is_admin as boolean | undefined,
    canUseExamMode: body.can_use_exam_mode as boolean | undefined,
  });
  return c.json(result);
});

// PUT /admin/users/:id/exams — replace the user's exam grants
adminRoutes.put("/users/:id/exams", async (c) => {
  const db = c.get("db");
  const userId = Number(c.req.param("id"));
  if (!Number.isInteger(userId)) throw new AppError(400, "Invalid user id");

  const body = await c.req.json<{ exam_ids?: unknown }>().catch(() => {
    throw new AppError(400, "Invalid JSON body");
  });
  if (!body || !Array.isArray(body.exam_ids)) {
    throw new AppError(400, "exam_ids (array of exam ids) is required");
  }

  const result = await setUserExamAccess(db, userId, body.exam_ids as number[]);
  return c.json(result);
});

// PUT /admin/users/:id/exams/:examId/domains — replace the user's domain
// whitelist for one exam; an empty list lifts the restriction
adminRoutes.put("/users/:id/exams/:examId/domains", async (c) => {
  const db = c.get("db");
  const userId = Number(c.req.param("id"));
  const examId = Number(c.req.param("examId"));
  if (!Number.isInteger(userId)) throw new AppError(400, "Invalid user id");
  if (!Number.isInteger(examId)) throw new AppError(400, "Invalid exam id");

  const body = await c.req.json<{ domain_ids?: unknown }>().catch(() => {
    throw new AppError(400, "Invalid JSON body");
  });
  if (!body || !Array.isArray(body.domain_ids)) {
    throw new AppError(400, "domain_ids (array of domain ids) is required");
  }

  const result = await setUserExamDomains(db, userId, examId, body.domain_ids as number[]);
  return c.json(result);
});

export default adminRoutes;
