"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import BookmarkButton from "@/components/question/BookmarkButton";
import ExplanationPanel from "@/components/question/ExplanationPanel";
import HotspotAnswerArea from "@/components/question/HotspotAnswerArea";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { Question, SubmitAnswerResponse } from "@/types";

interface QuestionCardProps {
  question: Question;
  onAnswered?: (isCorrect: boolean) => void;
}

export default function QuestionCard({ question, onAnswered }: QuestionCardProps) {
  // Ordered rather than a Set: a hotspot answer is one pick per row, so position
  // carries meaning and the same option may repeat. null = that row is unanswered.
  const [selected, setSelected] = useState<(number | null)[]>([]);
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(question.is_bookmarked);
  const questionIdRef = useRef(question.id);

  const isMulti = question.question_type === "multi";
  const isHotspot = question.question_type === "hotspot";
  const hotspotRows = useMemo(() => question.hotspot_rows ?? [], [question.hotspot_rows]);
  const isAnswered = result !== null;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Every row picked for hotspot; at least one option otherwise.
  const isComplete = isHotspot
    ? hotspotRows.length > 0 &&
      selected.length === hotspotRows.length &&
      !selected.includes(null)
    : selected.length > 0;

  // Restore previous answer — re-submit to get correct_option_ids
  useEffect(() => {
    questionIdRef.current = question.id;
    setResult(null);
    setBookmarked(question.is_bookmarked);

    if (question.user_progress) {
      const ids = question.user_progress.selected_option_ids;
      setSelected(ids);
      // Re-submit to get full answer data (correct options, explanation)
      api.submitAnswer(question.id, ids).then((res) => {
        if (questionIdRef.current === question.id) {
          setResult(res);
        }
      });
    } else {
      setSelected(
        question.question_type === "hotspot"
          ? new Array(question.hotspot_rows?.length ?? 0).fill(null)
          : []
      );
    }
  }, [question]);

  const handleSubmit = useCallback(async () => {
    if (!isComplete || submitting) return;
    const currentQId = question.id;
    setSubmitting(true);
    try {
      const res = await api.submitAnswer(currentQId, selected as number[]);
      if (questionIdRef.current === currentQId) {
        setResult(res);
        onAnswered?.(res.is_correct);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [selected, isComplete, submitting, question.id, onAnswered]);

  const toggleOption = (optionId: number) => {
    if (isAnswered) return;
    setSelected((prev) => {
      if (!isMulti) return [optionId];
      return prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId];
    });
  };

  const pickHotspotRow = (rowIndex: number, optionId: number) => {
    // Blocked while submitting too, so the graded answer always matches what the
    // per-row marks are about to be drawn against.
    if (isAnswered || submitting) return;
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

  // For single choice, auto-submit when not already answered
  const pendingAutoSubmit = useRef(false);
  useEffect(() => {
    if (
      !isMulti &&
      !isHotspot &&
      selected.length === 1 &&
      !isAnswered &&
      !submitting &&
      !question.user_progress
    ) {
      pendingAutoSubmit.current = true;
    }
  }, [selected, isMulti, isHotspot, isAnswered, submitting, question.user_progress]);

  useEffect(() => {
    if (pendingAutoSubmit.current) {
      pendingAutoSubmit.current = false;
      handleSubmit();
    }
  }, [selected, handleSubmit]);

  const getOptionStyle = (optionId: number) => {
    const base = "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all text-sm";
    if (!isAnswered) {
      return selectedSet.has(optionId)
        ? `${base} border-accent-500 bg-accent-50`
        : `${base} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
    }
    const correctIds = result.correct_option_ids;
    const isCorrect = correctIds.includes(optionId);
    const wasSelected = selectedSet.has(optionId);
    if (isCorrect) return `${base} border-green-500 bg-green-50`;
    if (wasSelected && !isCorrect) return `${base} border-red-500 bg-red-50`;
    return `${base} border-gray-200 opacity-60`;
  };

  const typeBadge = isHotspot ? "HotSpot" : isMulti ? `Select ${question.num_correct}` : "Single Choice";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="accent">{question.external_id}</Badge>
            <Badge color={isMulti || isHotspot ? "yellow" : "gray"}>{typeBadge}</Badge>
          </div>
          <div className="text-base text-gray-900 leading-relaxed">
            <MarkdownRenderer content={question.question_text} />
          </div>
        </div>
        <BookmarkButton
          questionId={question.id}
          bookmarked={bookmarked}
          onToggle={setBookmarked}
        />
      </div>

      {isHotspot ? (
        <HotspotAnswerArea
          rows={hotspotRows}
          options={question.options}
          picks={selected}
          onChange={isAnswered || submitting ? undefined : pickHotspotRow}
          correctOptionIds={result?.correct_option_ids}
          rowHeader={question.hotspot_row_header}
          choiceHeader={question.hotspot_choice_header}
        />
      ) : (
        <div className="space-y-2">
          {question.options.map((opt) => (
            <button
              key={opt.id}
              className={getOptionStyle(opt.id)}
              onClick={() => toggleOption(opt.id)}
              disabled={isAnswered}
            >
              <span className="font-semibold mr-2">{opt.label}.</span>
              <MarkdownRenderer content={opt.option_text} compact />
            </button>
          ))}
        </div>
      )}

      {(isMulti || isHotspot) && !isAnswered && (
        <Button onClick={handleSubmit} disabled={!isComplete || submitting}>
          {submitting ? "Submitting..." : "Submit Answer"}
        </Button>
      )}

      {result && (
        <ExplanationPanel
          isCorrect={result.is_correct}
          explanation={result.explanation}
          domainName={result.domain_name}
          // Hotspot correctness is per row, not per option — every option would
          // render as "wrong" here. The answer area already shows the marks.
          options={isHotspot ? undefined : result.options}
        />
      )}
    </div>
  );
}
