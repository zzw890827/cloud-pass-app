import { Hono } from "hono";
import { eq, count } from "drizzle-orm";
import type { AppEnv } from "../types/env";
import { providers, exams } from "../db/schema";
import { AppError } from "../lib/errors";

const providerRoutes = new Hono<AppEnv>();

// GET /providers — list all with exam_count
providerRoutes.get("/", async (c) => {
  const db = c.get("db");

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
    .leftJoin(exams, eq(exams.providerId, providers.id))
    .groupBy(providers.id)
    .orderBy(providers.name);

  return c.json(
    rows.map((r) => ({
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
  const id = Number(c.req.param("id"));

  const provider = await db.query.providers.findFirst({
    where: eq(providers.id, id),
  });

  if (!provider) throw new AppError(404, "Provider not found");

  const examList = await db
    .select({
      id: exams.id,
      code: exams.code,
      name: exams.name,
      totalQuestions: exams.totalQuestions,
      isActive: exams.isActive,
    })
    .from(exams)
    .where(eq(exams.providerId, id))
    .orderBy(exams.code);

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
    })),
  });
});

export default providerRoutes;
