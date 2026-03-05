import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import type { AppEnv } from "../types/env";
import { users } from "../db/schema";
import { verifyCfAccessJwt } from "../lib/cf-access";
import { AppError } from "../lib/errors";

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  let email: string;

  if (c.env.DEV_MODE === "true") {
    // Dev bypass: use header or default test user
    email = c.req.header("X-Dev-User-Email") || "dev@example.com";
  } else {
    // Production: verify CF Access JWT
    const token = c.req.header("Cf-Access-Jwt-Assertion");
    if (!token) {
      throw new AppError(401, "Missing CF Access token");
    }
    const result = await verifyCfAccessJwt(token, c.env.CF_TEAM_DOMAIN);
    email = result.email;
  }

  // Find or auto-create user
  let user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    const displayName = email.split("@")[0];
    const [created] = await db
      .insert(users)
      .values({ email, displayName })
      .returning();
    user = created;
  }

  if (!user.isActive) {
    throw new AppError(403, "Account is deactivated");
  }

  c.set("user", {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isActive: user.isActive,
    isAdmin: user.isAdmin,
  });

  await next();
});

export const adminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const user = c.get("user");
  if (!user.isAdmin) {
    throw new AppError(403, "Admin access required");
  }
  await next();
});
