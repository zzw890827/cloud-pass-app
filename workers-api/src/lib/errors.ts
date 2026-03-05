import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    message: string
  ) {
    super(message);
  }
}

export function onError(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json({ detail: err.message }, err.status);
  }
  console.error("Unhandled error:", err);
  return c.json({ detail: "Internal server error" }, 500);
}
