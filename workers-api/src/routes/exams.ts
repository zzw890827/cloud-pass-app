import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppEnv } from "../types/env";
import { exams, providers, examSessions } from "../db/schema";
import { getProgressSummary } from "../services/progress-service";
import { AppError } from "../lib/errors";

const examRoutes = new Hono<AppEnv>();

// GET /exams — list (optionally by provider_id)
examRoutes.get("/", async (c) => {
  const db = c.get("db");
  const providerId = c.req.query("provider_id");

  let query = db
    .select({
      id: exams.id,
      providerId: exams.providerId,
      code: exams.code,
      name: exams.name,
      description: exams.description,
      totalQuestions: exams.totalQuestions,
      isActive: exams.isActive,
      numQuestions: exams.numQuestions,
      passPercentage: exams.passPercentage,
      timeLimitMinutes: exams.timeLimitMinutes,
      providerName: providers.name,
    })
    .from(exams)
    .innerJoin(providers, eq(exams.providerId, providers.id))
    .orderBy(exams.code);

  const rows = providerId
    ? await query.where(eq(exams.providerId, Number(providerId)))
    : await query;

  return c.json(
    rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      code: r.code,
      name: r.name,
      description: r.description,
      total_questions: r.totalQuestions,
      is_active: r.isActive,
      num_questions: r.numQuestions,
      pass_percentage: r.passPercentage,
      time_limit_minutes: r.timeLimitMinutes,
      provider_name: r.providerName,
    }))
  );
});

// GET /exams/:id — detail with progress summary + active session
examRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("id"));

  const rows = await db
    .select({
      id: exams.id,
      providerId: exams.providerId,
      code: exams.code,
      name: exams.name,
      description: exams.description,
      totalQuestions: exams.totalQuestions,
      isActive: exams.isActive,
      numQuestions: exams.numQuestions,
      passPercentage: exams.passPercentage,
      timeLimitMinutes: exams.timeLimitMinutes,
      providerName: providers.name,
    })
    .from(exams)
    .innerJoin(providers, eq(exams.providerId, providers.id))
    .where(eq(exams.id, examId));

  if (rows.length === 0) throw new AppError(404, "Exam not found");
  const exam = rows[0];

  const progressSummary = await getProgressSummary(db, examId, user.id);

  // Find active session
  const activeSession = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.userId, user.id),
      eq(examSessions.examId, examId),
      eq(examSessions.status, "in_progress")
    ),
  });

  return c.json({
    id: exam.id,
    provider_id: exam.providerId,
    code: exam.code,
    name: exam.name,
    description: exam.description,
    total_questions: exam.totalQuestions,
    is_active: exam.isActive,
    num_questions: exam.numQuestions,
    pass_percentage: exam.passPercentage,
    time_limit_minutes: exam.timeLimitMinutes,
    provider_name: exam.providerName,
    progress_summary: progressSummary,
    active_session_id: activeSession?.id ?? null,
  });
});

export default examRoutes;
