import { z } from "zod";

export const createExamSessionSchema = z.object({
  exam_id: z.number().int().positive(),
});

export const submitSessionAnswerSchema = z.object({
  selected_option_ids: z.array(z.number().int()),
});
