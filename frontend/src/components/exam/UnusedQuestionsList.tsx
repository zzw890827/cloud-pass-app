"use client";

import { useState } from "react";
import Link from "next/link";
import type { ExamUnusedQuestions } from "@/types";

interface UnusedQuestionsListProps {
  report: ExamUnusedQuestions;
  examId: number;
}

const INITIAL_VISIBLE = 20;

export default function UnusedQuestionsList({ report, examId }: UnusedQuestionsListProps) {
  const [expanded, setExpanded] = useState(false);

  if (report.total_questions === 0) {
    return <p className="text-sm text-gray-500">This exam has no questions yet.</p>;
  }

  const unusedCount = report.unused_count;

  if (unusedCount === 0) {
    return (
      <p className="text-sm text-gray-500">
        Every question in this exam has been drawn into at least one of your exam sessions.
      </p>
    );
  }

  const visible = expanded ? report.items : report.items.slice(0, INITIAL_VISIBLE);
  const coveredPercent = Math.floor(
    ((report.total_questions - unusedCount) / report.total_questions) * 100
  );
  // The API caps how many rows it returns; say so instead of silently listing fewer.
  const capped = report.items.length < unusedCount;

  return (
    <div>
      <p className="text-sm text-gray-600">
        <span className="font-semibold text-gray-900">{unusedCount}</span> of{" "}
        {report.total_questions} questions have never been drawn into an exam session
        <span className="text-gray-500"> ({coveredPercent}% covered)</span>
      </p>

      <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
        {visible.map((item) => (
          <li key={item.question_id}>
            <Link
              href={`/exams/${examId}/practice?questionId=${item.question_id}`}
              className="py-2 px-1 flex gap-3 items-start hover:bg-gray-50"
            >
              <span className="w-20 shrink-0 truncate text-xs font-medium text-accent-600 underline mt-0.5">
                {item.external_id}
              </span>
              <span className="min-w-0 flex-1 text-sm text-gray-600 line-clamp-2">
                {item.question_preview}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {report.items.length > INITIAL_VISIBLE && (
        <button
          type="button"
          className="mt-3 text-sm text-accent-600 hover:underline cursor-pointer"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : `Show all ${report.items.length} questions`}
        </button>
      )}

      {capped && (
        <p className="mt-2 text-xs text-gray-500">
          Only the first {report.items.length} of {unusedCount} never-drawn questions are
          listed.
        </p>
      )}
    </div>
  );
}
