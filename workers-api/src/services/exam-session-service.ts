import { eq, and, sql, count, inArray, desc, asc } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  exams,
  questions,
  options,
  examSessions,
  examSessionQuestions,
  providers,
} from "../db/schema";
import { AppError } from "../lib/errors";

// --- Weighted question selection ---

async function selectWeightedQuestions(
  db: Database,
  examId: number,
  userId: number,
  numToSelect: number
): Promise<number[]> {
  // Get all question IDs for exam
  const allQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.examId, examId));

  const allIds = allQuestions.map((q) => q.id);

  if (allIds.length <= numToSelect) {
    // Shuffle and return all
    return shuffleArray(allIds);
  }

  // Get pick_count and error_count from past sessions
  const historyRows = await db
    .select({
      questionId: examSessionQuestions.questionId,
      pickCount: count(),
      errorCount:
        sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} = 0 THEN 1 ELSE 0 END)`.as(
          "error_count"
        ),
      answeredCount:
        sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} IS NOT NULL THEN 1 ELSE 0 END)`.as(
          "answered_count"
        ),
    })
    .from(examSessionQuestions)
    .innerJoin(examSessions, eq(examSessionQuestions.sessionId, examSessions.id))
    .where(and(eq(examSessions.userId, userId), eq(examSessions.examId, examId)))
    .groupBy(examSessionQuestions.questionId);

  const historyMap = new Map(
    historyRows.map((r) => [
      r.questionId,
      {
        pickCount: r.pickCount,
        errorCount: r.errorCount ?? 0,
        answeredCount: r.answeredCount ?? 0,
      },
    ])
  );

  // Calculate weights
  type WeightedItem = { id: number; weight: number };
  const weighted: WeightedItem[] = allIds.map((id) => {
    const history = historyMap.get(id);
    if (!history) {
      // Never attempted: weight = 4.0
      return { id, weight: 4.0 };
    }
    const errorRate =
      history.answeredCount > 0 ? history.errorCount / history.answeredCount : 0;
    const weight = 1.0 + 1.0 / (history.pickCount + 1) + errorRate * 2.0;
    return { id, weight };
  });

  // Weighted random sampling without replacement
  const selected: number[] = [];
  const remaining = [...weighted];

  for (let i = 0; i < numToSelect; i++) {
    const totalWeight = remaining.reduce((sum, item) => sum + item.weight, 0);
    let random = Math.random() * totalWeight;

    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].weight;
      if (random <= 0) {
        selected.push(remaining[j].id);
        remaining.splice(j, 1);
        break;
      }
    }
  }

  return selected;
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// --- Session CRUD ---

export async function createSession(db: Database, userId: number, examId: number) {
  // Check exam exists
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });
  if (!exam) throw new AppError(404, "Exam not found");

  // Check for existing active session
  const active = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.userId, userId),
      eq(examSessions.examId, examId),
      eq(examSessions.status, "in_progress")
    ),
  });
  if (active) throw new AppError(409, "An active session already exists for this exam");

  // Select questions
  const questionIds = await selectWeightedQuestions(db, examId, userId, exam.numQuestions);

  // Create session
  const [session] = await db
    .insert(examSessions)
    .values({
      userId,
      examId,
      numQuestions: exam.numQuestions,
      passPercentage: exam.passPercentage,
      timeLimitMinutes: exam.timeLimitMinutes,
    })
    .returning();

  // Create session questions
  for (let i = 0; i < questionIds.length; i++) {
    await db.insert(examSessionQuestions).values({
      sessionId: session.id,
      questionId: questionIds[i],
      orderIndex: i,
    });
  }

  return formatSessionResponse(db, session.id);
}

export async function getSession(db: Database, sessionId: number, userId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");

  return formatSessionResponse(db, session.id);
}

export async function getActiveSession(db: Database, userId: number, examId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(
      eq(examSessions.userId, userId),
      eq(examSessions.examId, examId),
      eq(examSessions.status, "in_progress")
    ),
  });

  if (!session) return null;
  return formatSessionResponse(db, session.id);
}

export async function getSessionQuestion(
  db: Database,
  sessionId: number,
  orderIndex: number,
  userId: number
) {
  // Verify session belongs to user
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");

  const sessionQuestion = await db.query.examSessionQuestions.findFirst({
    where: and(
      eq(examSessionQuestions.sessionId, sessionId),
      eq(examSessionQuestions.orderIndex, orderIndex)
    ),
  });
  if (!sessionQuestion) throw new AppError(404, "Question not found at this index");

  const question = await db.query.questions.findFirst({
    where: eq(questions.id, sessionQuestion.questionId),
  });
  if (!question) throw new AppError(404, "Question not found");

  const opts = await db
    .select({
      id: options.id,
      label: options.label,
      optionText: options.optionText,
      orderIndex: options.orderIndex,
    })
    .from(options)
    .where(eq(options.questionId, question.id))
    .orderBy(options.orderIndex);

  return {
    session_question_id: sessionQuestion.id,
    question_id: question.id,
    order_index: sessionQuestion.orderIndex,
    external_id: question.externalId,
    question_text: question.questionText,
    question_type: question.questionType,
    num_correct: question.numCorrect,
    options: opts.map((o) => ({
      id: o.id,
      label: o.label,
      option_text: o.optionText,
    })),
    selected_option_ids: sessionQuestion.selectedOptionIds
      ? (JSON.parse(sessionQuestion.selectedOptionIds) as number[])
      : null,
    is_correct: sessionQuestion.isCorrect,
  };
}

export async function submitSessionAnswer(
  db: Database,
  sessionId: number,
  orderIndex: number,
  userId: number,
  selectedOptionIds: number[]
) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");
  if (session.status !== "in_progress")
    throw new AppError(400, "Session is not in progress");

  const sessionQuestion = await db.query.examSessionQuestions.findFirst({
    where: and(
      eq(examSessionQuestions.sessionId, sessionId),
      eq(examSessionQuestions.orderIndex, orderIndex)
    ),
  });
  if (!sessionQuestion) throw new AppError(404, "Question not found at this index");

  // Check correctness
  const opts = await db
    .select()
    .from(options)
    .where(eq(options.questionId, sessionQuestion.questionId));

  const correctIds = new Set(opts.filter((o) => o.isCorrect).map((o) => o.id));
  const selectedSet = new Set(selectedOptionIds);
  const isCorrect =
    correctIds.size === selectedSet.size && [...correctIds].every((id) => selectedSet.has(id));

  await db
    .update(examSessionQuestions)
    .set({
      selectedOptionIds: JSON.stringify(selectedOptionIds),
      isCorrect,
    })
    .where(eq(examSessionQuestions.id, sessionQuestion.id));

  return { is_answered: true };
}

export async function completeSession(db: Database, sessionId: number, userId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");
  if (session.status !== "in_progress")
    throw new AppError(400, "Session is not in progress");

  const sessionQuestions = await db
    .select()
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.sessionId, sessionId))
    .orderBy(examSessionQuestions.orderIndex);

  let correctCount = 0;
  let totalAnswered = 0;

  for (const sq of sessionQuestions) {
    if (sq.isCorrect !== null) {
      totalAnswered++;
      if (sq.isCorrect) correctCount++;
    }
  }

  const score = Math.round((correctCount / session.numQuestions) * 1000) / 10;
  const passed = score >= session.passPercentage;

  await db
    .update(examSessions)
    .set({
      status: "completed",
      score,
      correctCount,
      totalAnswered,
      passed,
      completedAt: sql`datetime('now')`,
    })
    .where(eq(examSessions.id, sessionId));

  return getSessionResult(db, sessionId, userId);
}

export async function abandonSession(db: Database, sessionId: number, userId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");
  if (session.status !== "in_progress")
    throw new AppError(400, "Session is not in progress");

  await db
    .update(examSessions)
    .set({
      status: "abandoned",
      completedAt: sql`datetime('now')`,
    })
    .where(eq(examSessions.id, sessionId));
}

export async function getSessionResult(db: Database, sessionId: number, userId: number) {
  const rows = await db
    .select({
      session: examSessions,
      examCode: exams.code,
      examName: exams.name,
    })
    .from(examSessions)
    .innerJoin(exams, eq(examSessions.examId, exams.id))
    .where(and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)));

  if (rows.length === 0) throw new AppError(404, "Session not found");
  const { session, examCode, examName } = rows[0];

  const sessionQuestions = await db
    .select({
      id: examSessionQuestions.id,
      questionId: examSessionQuestions.questionId,
      orderIndex: examSessionQuestions.orderIndex,
      selectedOptionIds: examSessionQuestions.selectedOptionIds,
      isCorrect: examSessionQuestions.isCorrect,
      externalId: questions.externalId,
      questionText: questions.questionText,
      questionType: questions.questionType,
    })
    .from(examSessionQuestions)
    .innerJoin(questions, eq(examSessionQuestions.questionId, questions.id))
    .where(eq(examSessionQuestions.sessionId, sessionId))
    .orderBy(examSessionQuestions.orderIndex);

  // Fetch all options for all questions in one query
  const qIds = sessionQuestions.map((sq) => sq.questionId);
  const allOptions =
    qIds.length > 0
      ? await db
          .select()
          .from(options)
          .where(inArray(options.questionId, qIds))
          .orderBy(options.orderIndex)
      : [];

  const optionsByQuestion = new Map<number, typeof allOptions>();
  for (const opt of allOptions) {
    const arr = optionsByQuestion.get(opt.questionId) || [];
    arr.push(opt);
    optionsByQuestion.set(opt.questionId, arr);
  }

  const questionResults = sessionQuestions.map((sq) => {
    const opts = optionsByQuestion.get(sq.questionId) || [];
    return {
      order_index: sq.orderIndex,
      question_id: sq.questionId,
      external_id: sq.externalId,
      question_text: sq.questionText,
      question_type: sq.questionType,
      selected_option_ids: sq.selectedOptionIds
        ? (JSON.parse(sq.selectedOptionIds) as number[])
        : null,
      is_correct: sq.isCorrect,
      options: opts.map((o) => ({
        id: o.id,
        label: o.label,
        option_text: o.optionText,
        is_correct: o.isCorrect,
      })),
    };
  });

  return {
    id: session.id,
    exam_id: session.examId,
    exam_code: examCode,
    exam_name: examName,
    status: session.status,
    num_questions: session.numQuestions,
    pass_percentage: session.passPercentage,
    time_limit_minutes: session.timeLimitMinutes,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    score: session.score,
    correct_count: session.correctCount,
    total_answered: session.totalAnswered,
    passed: session.passed,
    question_results: questionResults,
  };
}

export async function getSessionHistory(db: Database, userId: number, examId: number) {
  const exam = await db.query.exams.findFirst({
    where: eq(exams.id, examId),
  });
  if (!exam) throw new AppError(404, "Exam not found");

  const sessions = await db
    .select()
    .from(examSessions)
    .where(
      and(
        eq(examSessions.userId, userId),
        eq(examSessions.examId, examId),
        eq(examSessions.status, "completed")
      )
    )
    .orderBy(desc(examSessions.completedAt));

  return {
    exam_id: exam.id,
    exam_code: exam.code,
    exam_name: exam.name,
    items: sessions.map((s) => ({
      id: s.id,
      status: s.status,
      num_questions: s.numQuestions,
      pass_percentage: s.passPercentage,
      score: s.score,
      correct_count: s.correctCount,
      total_answered: s.totalAnswered,
      passed: s.passed,
      started_at: s.startedAt,
      completed_at: s.completedAt,
    })),
  };
}

export async function getErrorReport(db: Database, userId: number, examId: number) {
  const rows = await db
    .select({
      questionId: examSessionQuestions.questionId,
      externalId: questions.externalId,
      attemptCount: count(),
      errorCount:
        sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} = 0 THEN 1 ELSE 0 END)`.as(
          "error_count"
        ),
    })
    .from(examSessionQuestions)
    .innerJoin(examSessions, eq(examSessionQuestions.sessionId, examSessions.id))
    .innerJoin(questions, eq(examSessionQuestions.questionId, questions.id))
    .where(
      and(
        eq(examSessions.userId, userId),
        eq(examSessions.examId, examId),
        eq(examSessions.status, "completed"),
        sql`${examSessionQuestions.isCorrect} IS NOT NULL`
      )
    )
    .groupBy(examSessionQuestions.questionId, questions.externalId)
    .having(sql`error_count > 0`)
    .orderBy(sql`error_count DESC`);

  return {
    exam_id: examId,
    items: rows.map((r) => ({
      question_id: r.questionId,
      external_id: r.externalId,
      error_count: r.errorCount,
      attempt_count: r.attemptCount,
      error_rate: r.attemptCount > 0 ? r.errorCount / r.attemptCount : 0,
    })),
  };
}

// --- Helper to format session response ---

async function formatSessionResponse(db: Database, sessionId: number) {
  const rows = await db
    .select({
      session: examSessions,
      examCode: exams.code,
      examName: exams.name,
    })
    .from(examSessions)
    .innerJoin(exams, eq(examSessions.examId, exams.id))
    .where(eq(examSessions.id, sessionId));

  if (rows.length === 0) throw new AppError(404, "Session not found");
  const { session, examCode, examName } = rows[0];

  const sessionQs = await db
    .select({
      id: examSessionQuestions.id,
      questionId: examSessionQuestions.questionId,
      orderIndex: examSessionQuestions.orderIndex,
      isCorrect: examSessionQuestions.isCorrect,
      selectedOptionIds: examSessionQuestions.selectedOptionIds,
    })
    .from(examSessionQuestions)
    .where(eq(examSessionQuestions.sessionId, sessionId))
    .orderBy(examSessionQuestions.orderIndex);

  return {
    id: session.id,
    exam_id: session.examId,
    exam_code: examCode,
    exam_name: examName,
    status: session.status,
    num_questions: session.numQuestions,
    pass_percentage: session.passPercentage,
    time_limit_minutes: session.timeLimitMinutes,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    score: session.score,
    questions: sessionQs.map((sq) => ({
      id: sq.id,
      question_id: sq.questionId,
      order_index: sq.orderIndex,
      is_answered: sq.selectedOptionIds !== null,
      is_correct: sq.isCorrect,
    })),
  };
}
