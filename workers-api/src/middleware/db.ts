import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types/env";
import { createDb } from "../db/client";

export const dbMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(c.env.CLOUD_PASS_DB);
  c.set("db", db);
  await next();
});
