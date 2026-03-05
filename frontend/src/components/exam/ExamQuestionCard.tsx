"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { ExamSessionQuestionDetail } from "@/types";

interface ExamQuestionCardProps {
  question: ExamSessionQuestionDetail;
  onSubmit: (selectedOptionIds: number[]) => Promise<void>;
}

export default function ExamQuestionCard({ question, onSubmit }: ExamQuestionCardProps) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const questionIdRef = useRef(question.session_question_id);

  const isMulti = question.question_type === "multi";

  // Reset state on question change
  useEffect(() => {
    questionIdRef.current = question.session_question_id;
    if (question.selected_option_ids) {
      setSelected(new Set(question.selected_option_ids));
      setSubmitted(true);
    } else {
      setSelected(new Set());
      setSubmitted(false);
    }
  }, [question]);

  const handleSubmit = useCallback(async () => {
    if (selected.size === 0 || submitting || submitted) return;
    const currentId = question.session_question_id;
    setSubmitting(true);
    try {
      await onSubmit(Array.from(selected));
      if (questionIdRef.current === currentId) {
        setSubmitted(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting, submitted, question.session_question_id, onSubmit]);

  const toggleOption = (optionId: number) => {
    if (submitted) return;
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

  // Auto-submit for single choice (no answer reveal)
  const pendingAutoSubmit = useRef(false);
  useEffect(() => {
    if (!isMulti && selected.size === 1 && !submitted && !submitting && !question.selected_option_ids) {
      pendingAutoSubmit.current = true;
    }
  }, [selected, isMulti, submitted, submitting, question.selected_option_ids]);

  useEffect(() => {
    if (pendingAutoSubmit.current) {
      pendingAutoSubmit.current = false;
      handleSubmit();
    }
  }, [selected, handleSubmit]);

  const getOptionStyle = (optionId: number) => {
    const base = "w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-all text-sm";
    if (selected.has(optionId)) {
      return `${base} border-blue-500 bg-blue-50`;
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
          <Badge color="blue">{question.external_id}</Badge>
          <Badge color={isMulti ? "yellow" : "gray"}>
            {isMulti ? `Select ${question.num_correct}` : "Single Choice"}
          </Badge>
        </div>
        <div className="text-base text-gray-900 leading-relaxed">
          <MarkdownRenderer content={question.question_text} />
        </div>
      </div>

      <div className="space-y-2">
        {question.options.map((opt) => (
          <button
            key={opt.id}
            className={getOptionStyle(opt.id)}
            onClick={() => toggleOption(opt.id)}
            disabled={submitted}
          >
            <span className="font-semibold mr-2">{opt.label}.</span>
            <MarkdownRenderer content={opt.option_text} compact />
          </button>
        ))}
      </div>

      {isMulti && !submitted && (
        <Button onClick={handleSubmit} disabled={selected.size === 0 || submitting}>
          {submitting ? "Submitting..." : "Lock Answer"}
        </Button>
      )}

      {submitted && (
        <p className="text-sm text-blue-600 font-medium">Answer locked</p>
      )}
    </div>
  );
}
