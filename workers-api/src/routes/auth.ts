import { Hono } from "hono";
import type { AppEnv } from "../types/env";

const auth = new Hono<AppEnv>();

// GET /auth/me — returns current user profile
auth.get("/me", (c) => {
  const user = c.get("user");
  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    is_active: user.isActive,
    is_admin: user.isAdmin,
    // Admins bypass the flag, so report the effective permission.
    can_use_exam_mode: user.isAdmin || user.canUseExamMode,
  });
});

export default auth;
