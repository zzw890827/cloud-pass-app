import { eq, and, sql, count, inArray, desc, asc } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  exams,
  questions,
  options,
  examSessions,
  examSessionQuestions,
  providers,
  userProgress,
  bookmarks,
} from "../db/schema";
import { AppError } from "../lib/errors";

// --- Weighted question selection ---

const WEIGHT_CONFIG = {
  BASE: 1.0,
  NEW_BONUS: 3.0,
  ERROR_COUNT_CAP: 5,
  ERROR_COUNT_FACTOR: 0.4,
  ERROR_RATE_FACTOR: 2.0,
  BOOKMARK_BONUS: 1.5,
  FORGETTING_FACTOR: 2.0,
  BASE_STABILITY_DAYS: 1.0,
  STABILITY_MULTIPLIER: 2.0,
  MAX_STABILITY_DAYS: 60.0,
  WRONG_ANSWER_STABILITY: 0.5,
};

function calculateForgettingFactor(
  daysSinceReview: number,
  correctRate: number,
  answeredCount: number,
  lastWasCorrect: boolean
): number {
  let stability: number;
  if (!lastWasCorrect) {
    stability = WEIGHT_CONFIG.WRONG_ANSWER_STABILITY;
  } else {
    const effectiveCount = Math.min(answeredCount, 5);
    const correctStreak = Math.round(correctRate * effectiveCount);
    stability = Math.min(
      WEIGHT_CONFIG.BASE_STABILITY_DAYS *
        Math.pow(WEIGHT_CONFIG.STABILITY_MULTIPLIER, Math.max(correctStreak - 1, 0)),
      WEIGHT_CONFIG.MAX_STABILITY_DAYS
    );
  }
  const retention = Math.exp(-daysSinceReview / stability);
  return 1 - retention;
}

async function selectWeightedQuestions(
  db: Database,
  examId: number,
  userId: number,
  numToSelect: number
): Promise<number[]> {
  // 4 parallel queries
  const [allQuestions, historyRows, practiceRows, bookmarkRows] = await Promise.all([
    // 1. All question IDs for exam
    db.select({ id: questions.id }).from(questions).where(eq(questions.examId, examId)),

    // 2. Exam session history with correctCount, lastAnsweredAt, lastWasCorrect
    db
      .select({
        questionId: examSessionQuestions.questionId,
        pickCount: count(),
        errorCount:
          sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} = 0 THEN 1 ELSE 0 END)`.as(
            "error_count"
          ),
        correctCount:
          sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} = 1 THEN 1 ELSE 0 END)`.as(
            "correct_count"
          ),
        answeredCount:
          sql<number>`SUM(CASE WHEN ${examSessionQuestions.isCorrect} IS NOT NULL THEN 1 ELSE 0 END)`.as(
            "answered_count"
          ),
        lastAnsweredAt:
          sql<string>`MAX(${examSessions.completedAt})`.as("last_answered_at"),
        lastWasCorrect: sql<number>`(
          SELECT esq2.is_correct FROM exam_session_questions esq2
          INNER JOIN exam_sessions es2 ON esq2.session_id = es2.id
          WHERE esq2.question_id = ${examSessionQuestions.questionId}
            AND es2.user_id = ${userId}
            AND es2.exam_id = ${examId}
            AND esq2.is_correct IS NOT NULL
            AND es2.completed_at IS NOT NULL
          ORDER BY es2.completed_at DESC
          LIMIT 1
        )`.as("last_was_correct"),
      })
      .from(examSessionQuestions)
      .innerJoin(examSessions, eq(examSessionQuestions.sessionId, examSessions.id))
      .where(and(eq(examSessions.userId, userId), eq(examSessions.examId, examId)))
      .groupBy(examSessionQuestions.questionId),

    // 3. Practice mode history from user_progress
    db
      .select({
        questionId: userProgress.questionId,
        isCorrect: userProgress.isCorrect,
        attemptedAt: userProgress.attemptedAt,
      })
      .from(userProgress)
      .innerJoin(questions, eq(userProgress.questionId, questions.id))
      .where(
        and(eq(userProgress.userId, userId), eq(questions.examId, examId))
      ),

    // 4. Bookmarked questions
    db
      .select({ questionId: bookmarks.questionId })
      .from(bookmarks)
      .innerJoin(questions, eq(bookmarks.questionId, questions.id))
      .where(
        and(eq(bookmarks.userId, userId), eq(questions.examId, examId))
      ),
  ]);

  const allIds = allQuestions.map((q) => q.id);

  if (allIds.length <= numToSelect) {
    return shuffleArray(allIds);
  }

  // Build lookup maps
  const examHistoryMap = new Map(
    historyRows.map((r) => [
      r.questionId,
      {
        pickCount: r.pickCount,
        errorCount: r.errorCount ?? 0,
        correctCount: r.correctCount ?? 0,
        answeredCount: r.answeredCount ?? 0,
        lastAnsweredAt: r.lastAnsweredAt,
        lastWasCorrect: r.lastWasCorrect === 1,
      },
    ])
  );

  const practiceMap = new Map(
    practiceRows.map((r) => [
      r.questionId,
      { isCorrect: r.isCorrect, attemptedAt: r.attemptedAt },
    ])
  );

  const bookmarkSet = new Set(bookmarkRows.map((r) => r.questionId));

  const now = Date.now();

  // Calculate weights
  type WeightedItem = { id: number; weight: number };
  const weighted: WeightedItem[] = allIds.map((id) => {
    const exam = examHistoryMap.get(id);
    const practice = practiceMap.get(id);
    const isBookmarked = bookmarkSet.has(id);

    // W_new: boost unseen questions
    const neverAttempted = !exam && !practice;
    const wNew = neverAttempted ? WEIGHT_CONFIG.NEW_BONUS : 0;

    // W_error: capped absolute error count
    const errorCount = exam?.errorCount ?? 0;
    const wError =
      Math.min(errorCount, WEIGHT_CONFIG.ERROR_COUNT_CAP) * WEIGHT_CONFIG.ERROR_COUNT_FACTOR;

    // W_errorRate: proportional wrongness
    const answeredCount = exam?.answeredCount ?? 0;
    const errorRate = answeredCount > 0 ? errorCount / answeredCount : 0;
    const wErrorRate = errorRate * WEIGHT_CONFIG.ERROR_RATE_FACTOR;

    // W_frequency: decay for frequently picked
    const pickCount = exam?.pickCount ?? 0;
    const wFrequency = 1.0 / (pickCount + 1);

    // W_bookmark
    const wBookmark = isBookmarked ? WEIGHT_CONFIG.BOOKMARK_BONUS : 0;

    // W_forgetting: Ebbinghaus curve
    let wForgetting = 0;
    if (exam || practice) {
      // Find most recent review timestamp from either source
      let lastReviewMs = 0;
      if (exam?.lastAnsweredAt) {
        const ts = exam.lastAnsweredAt.endsWith("Z")
          ? exam.lastAnsweredAt
          : exam.lastAnsweredAt + "Z";
        lastReviewMs = Math.max(lastReviewMs, new Date(ts).getTime());
      }
      if (practice?.attemptedAt) {
        const ts = practice.attemptedAt.endsWith("Z")
          ? practice.attemptedAt
          : practice.attemptedAt + "Z";
        lastReviewMs = Math.max(lastReviewMs, new Date(ts).getTime());
      }

      if (lastReviewMs > 0) {
        const daysSince = (now - lastReviewMs) / (1000 * 60 * 60 * 24);
        const correctCount = exam?.correctCount ?? 0;
        const totalAnswered = exam?.answeredCount ?? 0;
        const correctRate = totalAnswered > 0 ? correctCount / totalAnswered : 0;

        // Determine lastWasCorrect from whichever source is more recent
        let lastWasCorrect = true;
        if (exam?.lastAnsweredAt && practice?.attemptedAt) {
          const examTs = exam.lastAnsweredAt.endsWith("Z")
            ? exam.lastAnsweredAt
            : exam.lastAnsweredAt + "Z";
          const practiceTs = practice.attemptedAt.endsWith("Z")
            ? practice.attemptedAt
            : practice.attemptedAt + "Z";
          lastWasCorrect =
            new Date(practiceTs).getTime() > new Date(examTs).getTime()
              ? practice.isCorrect
              : exam.lastWasCorrect;
        } else if (practice) {
          lastWasCorrect = practice.isCorrect;
        } else if (exam) {
          lastWasCorrect = exam.lastWasCorrect;
        }

        const forgetting = calculateForgettingFactor(
          daysSince,
          correctRate,
          totalAnswered,
          lastWasCorrect
        );
        wForgetting = forgetting * WEIGHT_CONFIG.FORGETTING_FACTOR;
      }
    }

    const weight =
      WEIGHT_CONFIG.BASE + wNew + wError + wErrorRate + wFrequency + wBookmark + wForgetting;

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
      pausedAt: null,
      completedAt: sql`datetime('now')`,
    })
    .where(eq(examSessions.id, sessionId));

  return getSessionResult(db, sessionId, userId);
}

export async function pauseSession(db: Database, sessionId: number, userId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");
  if (session.status !== "in_progress")
    throw new AppError(400, "Session is not in progress");

  // Idempotent: if already paused, return current state
  if (session.pausedAt) {
    return formatSessionResponse(db, session.id);
  }

  // Calculate elapsed seconds since last resume/start
  const utcStarted = session.startedAt.endsWith("Z") ? session.startedAt : session.startedAt + "Z";
  const activeElapsed = Math.floor((Date.now() - new Date(utcStarted).getTime()) / 1000);
  const totalElapsed = session.elapsedSeconds + Math.max(0, activeElapsed);

  await db
    .update(examSessions)
    .set({
      pausedAt: sql`(datetime('now'))`,
      elapsedSeconds: totalElapsed,
    })
    .where(eq(examSessions.id, sessionId));

  return formatSessionResponse(db, session.id);
}

export async function resumeSession(db: Database, sessionId: number, userId: number) {
  const session = await db.query.examSessions.findFirst({
    where: and(eq(examSessions.id, sessionId), eq(examSessions.userId, userId)),
  });
  if (!session) throw new AppError(404, "Session not found");
  if (session.status !== "in_progress")
    throw new AppError(400, "Session is not in progress");

  // Idempotent: if not paused, return current state
  if (!session.pausedAt) {
    return formatSessionResponse(db, session.id);
  }

  // Check if time already expired while paused
  const totalAllowed = session.timeLimitMinutes * 60;
  if (session.elapsedSeconds >= totalAllowed) {
    // Auto-complete the session
    return completeSession(db, sessionId, userId);
  }

  // Reset startedAt to now so timer reference resets, clear pausedAt
  await db
    .update(examSessions)
    .set({
      pausedAt: null,
      startedAt: sql`(datetime('now'))`,
    })
    .where(eq(examSessions.id, sessionId));

  return formatSessionResponse(db, session.id);
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
      pausedAt: null,
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
    paused_at: session.pausedAt,
    elapsed_seconds: session.elapsedSeconds,
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
