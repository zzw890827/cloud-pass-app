import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { adminMiddleware } from "../middleware/auth";
import { importPayloadSchema, normalizeImportPayload } from "../schemas/import";
import { importQuestions } from "../services/import-service";
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

export default adminRoutes;
