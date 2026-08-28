import { Hono } from "hono";
import type { AppEnv } from "../types/env";
import { addBookmark, removeBookmark, getBookmarks } from "../services/bookmark-service";
import { assertQuestionAccess, examIdVisibleFilterFor } from "../lib/exam-access";
import { questions } from "../db/schema";

const bookmarkRoutes = new Hono<AppEnv>();

// POST /questions/:id/bookmark
bookmarkRoutes.post("/questions/:id/bookmark", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const questionId = Number(c.req.param("id"));

  await assertQuestionAccess(db, questionId, user);

  const result = await addBookmark(db, user.id, questionId);
  return c.json(result, 201);
});

// DELETE /questions/:id/bookmark
bookmarkRoutes.delete("/questions/:id/bookmark", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const questionId = Number(c.req.param("id"));

  await assertQuestionAccess(db, questionId, user);

  await removeBookmark(db, user.id, questionId);
  return c.body(null, 204);
});

// GET /bookmarks?exam_id=X
bookmarkRoutes.get("/bookmarks", async (c) => {
  const db = c.get("db");
  const user = c.get("user");
  const examId = c.req.query("exam_id");

  const result = await getBookmarks(
    db,
    user.id,
    examId ? Number(examId) : undefined,
    examIdVisibleFilterFor(questions.examId, user)
  );
  return c.json(result);
});

export default bookmarkRoutes;
