"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { ExamSessionResult, SessionQuestionResult } from "@/types";

function QuestionDetail({ question, index }: { question: SessionQuestionResult; index: number }) {
  const isMulti = question.question_type === "multi";
  const selectedSet = new Set(question.selected_option_ids ?? []);

  const getOptionStyle = (optId: number, isCorrect: boolean) => {
    const base = "w-full text-left p-3 sm:p-4 rounded-lg border-2 text-sm";
    const isSelected = selectedSet.has(optId);

    if (isCorrect && isSelected) return `${base} border-green-500 bg-green-50`;
    if (isCorrect) return `${base} border-green-400 bg-green-50 opacity-70`;
    if (isSelected) return `${base} border-red-500 bg-red-50`;
    return `${base} border-gray-200 opacity-60`;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge color="blue">{question.external_id}</Badge>
          <Badge color={isMulti ? "yellow" : "gray"}>
            {isMulti ? "Multiple Choice" : "Single Choice"}
          </Badge>
          {question.is_correct === true && <Badge color="green">Correct</Badge>}
          {question.is_correct === false && <Badge color="red">Incorrect</Badge>}
          {question.is_correct === null && <Badge color="gray">Unanswered</Badge>}
        </div>
        <p className="text-xs text-gray-500 mb-2">Question {index + 1}</p>
        <div className="text-base text-gray-900 leading-relaxed">
          <MarkdownRenderer content={question.question_text} />
        </div>
      </div>

      <div className="space-y-2">
        {question.options.map((opt) => (
          <div key={opt.id} className={getOptionStyle(opt.id, opt.is_correct)}>
            <div className="flex items-start gap-2">
              <span className="font-semibold shrink-0">{opt.label}.</span>
              <span className="flex-1">
                <MarkdownRenderer content={opt.option_text} compact />
              </span>
              <span className="shrink-0 ml-2">
                {opt.is_correct && (
                  <span className="text-green-600 text-xs font-medium">✓ Correct</span>
                )}
                {!opt.is_correct && selectedSet.has(opt.id) && (
                  <span className="text-red-600 text-xs font-medium">✗ Wrong</span>
                )}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExamResultPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.examId);
  const sessionId = Number(params.sessionId);

  const [result, setResult] = useState<ExamSessionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionId) return;
    api.getSessionResult(sessionId).then(setResult).finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (selectedIdx !== null && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedIdx]);

  if (loading || !result) return <Spinner className="mt-20" />;

  const scoreColor = result.passed ? "text-green-600" : "text-red-600";

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Exam Results</h1>
      <p className="text-sm text-gray-500 mt-1">
        {result.exam_code} — {result.exam_name}
      </p>

      <Card className="p-6 mt-6">
        <div className="text-center">
          <div className={`text-5xl font-bold ${scoreColor}`}>
            {result.score?.toFixed(1)}%
          </div>
          <div className="mt-2">
            <Badge color={result.passed ? "green" : "red"}>
              {result.passed ? "PASSED" : "FAILED"}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-3">
            Pass mark: {result.pass_percentage}%
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600">{result.correct_count}</div>
            <div className="text-xs text-gray-500">Correct</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600">
              {(result.total_answered ?? 0) - (result.correct_count ?? 0)}
            </div>
            <div className="text-xs text-gray-500">Incorrect</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-400">
              {result.num_questions - (result.total_answered ?? 0)}
            </div>
            <div className="text-xs text-gray-500">Unanswered</div>
          </div>
        </div>
      </Card>

      {/* Question results */}
      <Card className="p-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Question Results</h2>
        <div className="flex flex-wrap gap-1.5">
          {result.question_results.map((qr, idx) => {
            let bg = "bg-gray-100 text-gray-600"; // unanswered
            if (qr.is_correct === true) bg = "bg-green-100 text-green-700";
            else if (qr.is_correct === false) bg = "bg-red-100 text-red-700";

            const isSelected = selectedIdx === idx;

            return (
              <button
                key={qr.question_id}
                className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs font-medium flex items-center justify-center cursor-pointer transition-all ${bg} ${
                  isSelected ? "ring-2 ring-blue-500 ring-offset-1 scale-110" : "hover:scale-105 hover:shadow-sm"
                }`}
                title={qr.external_id}
                onClick={() => setSelectedIdx(isSelected ? null : idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Question detail */}
      {selectedIdx !== null && (
        <div ref={detailRef}>
        <Card className="p-5 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">Question Detail</h2>
            <div className="flex items-center gap-2">
              <button
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                disabled={selectedIdx === 0}
                onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))}
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400">
                {selectedIdx + 1} / {result.question_results.length}
              </span>
              <button
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
                disabled={selectedIdx === result.question_results.length - 1}
                onClick={() => setSelectedIdx(Math.min(result.question_results.length - 1, selectedIdx + 1))}
              >
                Next →
              </button>
              <button
                className="text-xs text-gray-400 hover:text-gray-600 ml-2"
                onClick={() => setSelectedIdx(null)}
              >
                ✕
              </button>
            </div>
          </div>
          <QuestionDetail question={result.question_results[selectedIdx]} index={selectedIdx} />
        </Card>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        <Button onClick={() => router.push(`/exams/${examId}`)}>
          Back to Exam
        </Button>
        <Button variant="secondary" onClick={() => router.push(`/exams/${examId}/history`)}>
          Exam History
        </Button>
      </div>
    </div>
  );
}
