import { eq, and } from "drizzle-orm";
import type { Database } from "../db/client";
import { providers, exams, examDomains, questions, options } from "../db/schema";
import type { ImportPayload } from "../schemas/import";
import { AppError } from "../lib/errors";

export async function importQuestions(db: Database, data: ImportPayload) {
  // Upsert provider by slug
  let provider = await db.query.providers.findFirst({
    where: eq(providers.slug, data.provider.slug),
  });

  if (provider) {
    await db
      .update(providers)
      .set({
        name: data.provider.name,
        description: data.provider.description ?? provider.description,
        logoUrl: data.provider.logo_url ?? provider.logoUrl,
      })
      .where(eq(providers.id, provider.id));
  } else {
    const [created] = await db
      .insert(providers)
      .values({
        name: data.provider.name,
        slug: data.provider.slug,
        description: data.provider.description,
        logoUrl: data.provider.logo_url,
      })
      .returning();
    provider = created;
  }

  // Upsert exam by code
  let exam = await db.query.exams.findFirst({
    where: eq(exams.code, data.exam.code),
  });

  if (exam) {
    await db
      .update(exams)
      .set({
        name: data.exam.name,
        description: data.exam.description ?? exam.description,
        providerId: provider.id,
        ...(data.exam.num_questions !== undefined && { numQuestions: data.exam.num_questions }),
        ...(data.exam.pass_percentage !== undefined && { passPercentage: data.exam.pass_percentage }),
        ...(data.exam.time_limit_minutes !== undefined && { timeLimitMinutes: data.exam.time_limit_minutes }),
      })
      .where(eq(exams.id, exam.id));
  } else {
    const [created] = await db
      .insert(exams)
      .values({
        providerId: provider.id,
        code: data.exam.code,
        name: data.exam.name,
        description: data.exam.description,
        ...(data.exam.num_questions !== undefined && { numQuestions: data.exam.num_questions }),
        ...(data.exam.pass_percentage !== undefined && { passPercentage: data.exam.pass_percentage }),
        ...(data.exam.time_limit_minutes !== undefined && { timeLimitMinutes: data.exam.time_limit_minutes }),
      })
      .returning();
    exam = created;
  }

  // Upsert content domains (by exam_id + code) and build a code -> id lookup.
  // Pre-load existing domains so questions can reference domains that were
  // declared in a previous import without re-declaring them here.
  const domainByCode = new Map<string, number>();
  const existingDomains = await db
    .select({ id: examDomains.id, code: examDomains.code })
    .from(examDomains)
    .where(eq(examDomains.examId, exam.id));
  for (const d of existingDomains) domainByCode.set(d.code, d.id);

  if (data.exam.domains?.length) {
    for (let i = 0; i < data.exam.domains.length; i++) {
      const d = data.exam.domains[i];
      const orderIndex = d.order_index ?? i;
      const existingId = domainByCode.get(d.code);
      if (existingId !== undefined) {
        await db
          .update(examDomains)
          .set({ name: d.name, weight: d.weight, orderIndex })
          .where(eq(examDomains.id, existingId));
      } else {
        const [created] = await db
          .insert(examDomains)
          .values({ examId: exam.id, code: d.code, name: d.name, weight: d.weight, orderIndex })
          .returning();
        domainByCode.set(d.code, created.id);
      }
    }
  }

  // Get existing question external_ids for this exam
  const existingQuestions = await db
    .select({ externalId: questions.externalId })
    .from(questions)
    .where(eq(questions.examId, exam.id));

  const existingIds = new Set(existingQuestions.map((q) => q.externalId));

  let questionsImported = 0;
  let questionsSkipped = 0;
  let currentOrderIndex = existingIds.size;

  for (const q of data.exam.questions) {
    // Resolve & validate the question's domain (if any) against declared domains.
    let domainId: number | null = null;
    if (q.domain) {
      const resolved = domainByCode.get(q.domain);
      if (resolved === undefined) {
        throw new AppError(
          422,
          `Question "${q.external_id}" references unknown domain "${q.domain}". Declare it in exam.domains.`
        );
      }
      domainId = resolved;
    }

    if (existingIds.has(q.external_id)) {
      // Backfill the domain on a previously-imported question when provided.
      if (q.domain) {
        await db
          .update(questions)
          .set({ domainId })
          .where(and(eq(questions.examId, exam.id), eq(questions.externalId, q.external_id)));
      }
      questionsSkipped++;
      continue;
    }

    const numCorrect = q.options.filter((o) => o.is_correct).length;

    const [created] = await db
      .insert(questions)
      .values({
        examId: exam.id,
        domainId,
        externalId: q.external_id,
        questionText: q.text,
        questionType: q.type,
        explanation: q.explanation,
        numCorrect,
        orderIndex: currentOrderIndex,
      })
      .returning();

    for (let i = 0; i < q.options.length; i++) {
      const opt = q.options[i];
      await db.insert(options).values({
        questionId: created.id,
        label: opt.label,
        optionText: opt.text,
        isCorrect: opt.is_correct,
        orderIndex: i,
      });
    }

    currentOrderIndex++;
    questionsImported++;
  }

  // Update total_questions
  await db
    .update(exams)
    .set({ totalQuestions: currentOrderIndex })
    .where(eq(exams.id, exam.id));

  return {
    provider_id: provider.id,
    exam_id: exam.id,
    questions_imported: questionsImported,
    questions_skipped: questionsSkipped,
  };
}
