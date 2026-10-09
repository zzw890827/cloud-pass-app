import { Hono } from "hono";
import { eq, and, count } from "drizzle-orm";
import type { AppEnv } from "../types/env";
import { exams, examDomains, questions, providers, examSessions } from "../db/schema";
import { getProgressSummary } from "../services/progress-service";
import { AppError } from "../lib/errors";
import {
  assertExamAccess,
  domainVisibleFilter,
  examVisibleFilterFor,
  questionDomainFilterFor,
  visibleQuestionCountFor,
} from "../lib/exam-access";

const examRoutes = new Hono<AppEnv>();

// GET /exams — list (optionally by provider_id)
examRoutes.get("/", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const providerId = c.req.query("provider_id");

  const conditions = [examVisibleFilterFor(user)];
  if (providerId) conditions.push(eq(exams.providerId, Number(providerId)));
  const where = and(...conditions.filter((cond) => cond !== undefined));

  const query = db
    .select({
      id: exams.id,
      providerId: exams.providerId,
      code: exams.code,
      name: exams.name,
      description: exams.description,
      totalQuestions: visibleQuestionCountFor(user),
      isActive: exams.isActive,
      isPublic: exams.isPublic,
      numQuestions: exams.numQuestions,
      passPercentage: exams.passPercentage,
      timeLimitMinutes: exams.timeLimitMinutes,
      providerName: providers.name,
      providerSlug: providers.slug,
    })
    .from(exams)
    .innerJoin(providers, eq(exams.providerId, providers.id))
    .where(where)
    .orderBy(exams.code);

  const rows = await query;

  return c.json(
    rows.map((r) => ({
      id: r.id,
      provider_id: r.providerId,
      code: r.code,
      name: r.name,
      description: r.description,
      total_questions: r.totalQuestions,
      is_active: r.isActive,
      is_public: r.isPublic,
      num_questions: r.numQuestions,
      pass_percentage: r.passPercentage,
      time_limit_minutes: r.timeLimitMinutes,
      provider_name: r.providerName,
      provider_slug: r.providerSlug,
    }))
  );
});

// GET /exams/:id — detail with progress summary + active session
examRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = Number(c.req.param("id"));

  await assertExamAccess(db, examId, user);

  const rows = await db
    .select({
      id: exams.id,
      providerId: exams.providerId,
      code: exams.code,
      name: exams.name,
      description: exams.description,
      totalQuestions: visibleQuestionCountFor(user),
      isActive: exams.isActive,
      isPublic: exams.isPublic,
      numQuestions: exams.numQuestions,
      passPercentage: exams.passPercentage,
      timeLimitMinutes: exams.timeLimitMinutes,
      providerName: providers.name,
      providerSlug: providers.slug,
    })
    .from(exams)
    .innerJoin(providers, eq(exams.providerId, providers.id))
    .where(eq(exams.id, examId));

  if (rows.length === 0) throw new AppError(404, "Exam not found");
  const exam = rows[0];

  const progressSummary = await getProgressSummary(
    db,
    examId,
    user.id,
    questionDomainFilterFor(user)
  );

  // Content domains (with per-domain question counts), limited to the ones the
  // user may see. Empty for exams without domains.
  const domainRows = await db
    .select({
      id: examDomains.id,
      code: examDomains.code,
      name: examDomains.name,
      weight: examDomains.weight,
      questionCount: count(questions.id),
    })
    .from(examDomains)
    .leftJoin(questions, eq(questions.domainId, examDomains.id))
    .where(
      and(
        eq(examDomains.examId, examId),
        user.isAdmin ? undefined : domainVisibleFilter(examDomains.examId, examDomains.id, user.id)
      )
    )
    .groupBy(examDomains.id)
    .orderBy(examDomains.orderIndex);

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
    is_public: exam.isPublic,
    num_questions: exam.numQuestions,
    pass_percentage: exam.passPercentage,
    time_limit_minutes: exam.timeLimitMinutes,
    provider_name: exam.providerName,
    provider_slug: exam.providerSlug,
    progress_summary: progressSummary,
    active_session_id: activeSession?.id ?? null,
    domains: domainRows.map((d) => ({
      id: d.id,
      code: d.code,
      name: d.name,
      weight: d.weight,
      question_count: d.questionCount,
    })),
  });
});

export default examRoutes;
