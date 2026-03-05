"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import BookmarkButton from "@/components/question/BookmarkButton";
import ExplanationPanel from "@/components/question/ExplanationPanel";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { Question, SubmitAnswerResponse } from "@/types";

interface QuestionCardProps {
  question: Question;
  onAnswered?: (isCorrect: boolean) => void;
}

export default function QuestionCard({ question, onAnswered }: QuestionCardProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<SubmitAnswerResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(question.is_bookmarked);
  const questionIdRef = useRef(question.id);

  const isMulti = question.question_type === "multi";
  const isAnswered = result !== null;

  // Restore previous answer — re-submit to get correct_option_ids
  useEffect(() => {
    questionIdRef.current = question.id;
    setResult(null);
    setBookmarked(question.is_bookmarked);

    if (question.user_progress) {
      const ids = question.user_progress.selected_option_ids;
      setSelected(new Set(ids));
      // Re-submit to get full answer data (correct options, explanation)
      api.submitAnswer(question.id, ids).then((res) => {
        if (questionIdRef.current === question.id) {
          setResult(res);
        }
      });
    } else {
      setSelected(new Set());
    }
  }, [question]);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0 || submitting) return;
    const currentQId = question.id;
    setSubmitting(true);
    try {
      const res = await api.submitAnswer(currentQId, Array.from(selected));
      if (questionIdRef.current === currentQId) {
        setResult(res);
        onAnswered?.(res.is_correct);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, question.id, onAnswered]);

  const toggleOption = (optionId: number) => {
    if (isAnswered) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (isMulti) {
        next.has(optionId) ? next.delete(optionId) : next.add(optionId);
      } else {
        next.clear();
        next.add(optionId);
      }
      return next;
    });
  };

  // For single choice, auto-submit when not already answered
  const pendingAutoSubmit = useRef(false);
  useEffect(() => {
    if (!isMulti && selected.size === 1 && !isAnswered && !submitting && !question.user_progress) {
      pendingAutoSubmit.current = true;
    }
  }, [selected, isMulti, isAnswered, submitting, question.user_progress]);

  useEffect(() => {
    if (pendingAutoSubmit.current) {
      pendingAutoSubmit.current = false;
      handleSubmit();
    }
  }, [selected, handleSubmit]);

  const getOptionStyle = (optionId: number) => {
    const base = "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all text-sm";
    if (!isAnswered) {
      return selected.has(optionId)
        ? `${base} border-blue-500 bg-blue-50`
        : `${base} border-gray-200 hover:border-gray-300 hover:bg-gray-50`;
    }
    const correctIds = result.correct_option_ids;
    const isCorrect = correctIds.includes(optionId);
    const wasSelected = selected.has(optionId);
    if (isCorrect) return `${base} border-green-500 bg-green-50`;
    if (wasSelected && !isCorrect) return `${base} border-red-500 bg-red-50`;
    return `${base} border-gray-200 opacity-60`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge color="blue">{question.external_id}</Badge>
            <Badge color={isMulti ? "yellow" : "gray"}>
              {isMulti ? `Select ${question.num_correct}` : "Single Choice"}
            </Badge>
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

      {isMulti && !isAnswered && (
        <Button onClick={handleSubmit} disabled={selected.size === 0 || submitting}>
          {submitting ? "Submitting..." : "Submit Answer"}
        </Button>
      )}

      {result && (
        <ExplanationPanel
          isCorrect={result.is_correct}
          explanation={result.explanation}
          options={result.options}
        />
      )}
    </div>
  );
}
