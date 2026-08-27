import { Hono } from "hono";
import { eq, and, count } from "drizzle-orm";
import type { AppEnv } from "../types/env";
import { providers, exams } from "../db/schema";
import { AppError } from "../lib/errors";
import { examVisibleFilterFor } from "../lib/exam-access";

const providerRoutes = new Hono<AppEnv>();

// GET /providers — list all with exam_count
providerRoutes.get("/", async (c) => {
  const db = c.get("db");
  const user = c.get("user");

  // Join only the exams this user may see, so `exam_count` matches what they
  // will actually find on the provider page.
  const visible = examVisibleFilterFor(user);
  const joinOn = visible
    ? and(eq(exams.providerId, providers.id), visible)
    : eq(exams.providerId, providers.id);

  const rows = await db
    .select({
      id: providers.id,
      name: providers.name,
      slug: providers.slug,
      description: providers.description,
      logoUrl: providers.logoUrl,
      examCount: count(exams.id),
    })
    .from(providers)
    .leftJoin(exams, joinOn)
    .groupBy(providers.id)
    .orderBy(providers.name);

  // A provider with nothing visible in it is noise for a non-admin.
  const listed = user.isAdmin ? rows : rows.filter((r) => r.examCount > 0);

  return c.json(
    listed.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      logo_url: r.logoUrl,
      exam_count: r.examCount,
    }))
  );
});

// GET /providers/:id — detail with exams list
providerRoutes.get("/:id", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const id = Number(c.req.param("id"));

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });

  if (!provider) throw new AppError(404, "Provider not found");

  const visible = examVisibleFilterFor(user);
  const examList = await db
    .select({
      id: exams.id,
      code: exams.code,
      name: exams.name,
      totalQuestions: exams.totalQuestions,
      isActive: exams.isActive,
      isPublic: exams.isPublic,
    })
    .from(exams)
    .where(visible ? and(eq(exams.providerId, id), visible) : eq(exams.providerId, id))
    .orderBy(exams.code);

  // Mirror the list route: a provider with nothing visible in it does not exist
  // for this user, even via a direct URL.
  if (visible && examList.length === 0) {
    throw new AppError(404, "Provider not found");
  }

  return c.json({
    id: provider.id,
    name: provider.name,
    slug: provider.slug,
    description: provider.description,
    logo_url: provider.logoUrl,
    exam_count: examList.length,
    exams: examList.map((e) => ({
      id: e.id,
      code: e.code,
      name: e.name,
      total_questions: e.totalQuestions,
      is_active: e.isActive,
      is_public: e.isPublic,
    })),
  });
});

export default providerRoutes;
