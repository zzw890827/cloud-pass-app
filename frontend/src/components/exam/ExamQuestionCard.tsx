"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import HotspotAnswerArea from "@/components/question/HotspotAnswerArea";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { ExamSessionQuestionDetail } from "@/types";

interface ExamQuestionCardProps {
  question: ExamSessionQuestionDetail;
  onSubmit: (selectedOptionIds: number[]) => Promise<void>;
}

export default function ExamQuestionCard({ question, onSubmit }: ExamQuestionCardProps) {
  // Ordered rather than a Set: a hotspot answer is one pick per row, so position
  // carries meaning and the same option may repeat. null = that row is unanswered.
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const questionIdRef = useRef(question.session_question_id);

  const isMulti = question.question_type === "multi";
  const isHotspot = question.question_type === "hotspot";
  const hotspotRows = useMemo(() => question.hotspot_rows ?? [], [question.hotspot_rows]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Every row picked for hotspot; at least one option otherwise.
  const isComplete = isHotspot
    ? hotspotRows.length > 0 &&
      selected.length === hotspotRows.length &&
      !selected.includes(null)
    : selected.length > 0;

  // Reset state on question change
  useEffect(() => {
    questionIdRef.current = question.session_question_id;
    if (question.selected_option_ids) {
      setSelected(question.selected_option_ids);
      setSubmitted(true);
    } else {
      setSelected(
        question.question_type === "hotspot"
          ? new Array(question.hotspot_rows?.length ?? 0).fill(null)
          : []
      );
      setSubmitted(false);
    }
  }, [question]);

  const handleSubmit = useCallback(async () => {
    if (!isComplete || submitting || submitted) return;
    const currentId = question.session_question_id;
    setSubmitting(true);
    try {
      await onSubmit(selected as number[]);
      if (questionIdRef.current === currentId) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [selected, isComplete, submitting, submitted, question.session_question_id, onSubmit]);

  const toggleOption = (optionId: number) => {
    // Also blocked while submitting, so the locked answer always matches what is shown
    if (submitted || submitting) return;
    setSelected((prev) => {
      if (!isMulti) return [optionId];
      return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId];
    });
  };

  const pickHotspotRow = (rowIndex: number, optionId: number) => {
    if (submitted || submitting) return;
    setSelected((prev) => {
      // Pad or truncate rather than reset: if the row count somehow changed, the
      // picks that are still valid should survive.
      const next = new Array(hotspotRows.length).fill(null);
      prev.forEach((id, i) => {
        if (i < next.length) next[i] = id;
      });
      next[rowIndex] = optionId;
      return next;
    });
  };

  const getOptionStyle = (optionId: number) => {
    const base = "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all text-sm";
    if (selectedSet.has(optionId)) {
      return `${base} border-accent-500 bg-accent-50`;
    }
    if (submitted) {
      return `${base} border-gray-200 opacity-60`;
    }
    return `${base} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge color="accent">{question.external_id}</Badge>
          <Badge color={isMulti || isHotspot ? "yellow" : "gray"}>
            {isHotspot ? "HotSpot" : isMulti ? `Select ${question.num_correct}` : "Single Choice"}
          </Badge>
        </div>
        <div className="text-base text-gray-900 leading-relaxed">
          <MarkdownRenderer content={question.question_text} />
        </div>
      </div>

      {isHotspot ? (
        <HotspotAnswerArea
          rows={hotspotRows}
          options={question.options}
          picks={selected}
          // No correctOptionIds: the exam never reveals correctness before the result page.
          onChange={submitted || submitting ? undefined : pickHotspotRow}
        />
      ) : (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              className={getOptionStyle(opt.id)}
              onClick={() => toggleOption(opt.id)}
              disabled={submitted || submitting}
            >
              <span className="font-semibold mr-2">{opt.label}.</span>
              <MarkdownRenderer content={opt.option_text} compact />
            </button>
          ))}
        </div>
      )}

      {!submitted && (
        <div className="flex items-center gap-3">
          <Button onClick={handleSubmit} disabled={!isComplete || submitting}>
            {submitting ? "Submitting..." : "Lock Answer"}
          </Button>
          <p className="text-sm text-gray-500">
            You can change your selection until you lock the answer.
          </p>
        </div>
      )}

      {submitted && (
        <p className="text-sm text-accent-600 font-medium">Answer locked</p>
      )}
    </div>
  );
}
