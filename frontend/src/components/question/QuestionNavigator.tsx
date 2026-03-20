"use client";

import { useEffect, useState } from "react";
import type { QuestionListItem } from "@/types";

const PAGE_SIZE = 50;

interface QuestionNavigatorProps {
  questions: QuestionListItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
  totalQuestions?: number;
}

export default function QuestionNavigator({ questions, currentIndex, onSelect, totalQuestions }: QuestionNavigatorProps) {
  const displayTotal = totalQuestions ?? questions.length;
  const totalPages = Math.ceil(questions.length / PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(() => Math.floor(currentIndex / PAGE_SIZE));

  // Auto-switch page when the active question is outside the current page
  useEffect(() => {
    const targetPage = Math.floor(currentIndex / PAGE_SIZE);
    setCurrentPage(targetPage);
  }, [currentIndex]);

  const pageStart = currentPage * PAGE_SIZE;
  const pageEnd = Math.min(pageStart + PAGE_SIZE, questions.length);
  const pageQuestions = questions.slice(pageStart, pageEnd);

  return (
    <div className="flex flex-col gap-2">
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            &#8249; Prev
          </button>
          <span>
            {pageStart + 1}–{pageEnd} / {displayTotal}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next &#8250;
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1 sm:gap-1.5">
        {pageQuestions.map((q, pageIdx) => {
          const idx = pageStart + pageIdx;
          const isCurrent = idx === currentIndex;
          let bg = "bg-gray-100 text-gray-600 hover:bg-gray-200";
          if (q.is_attempted) {
            bg = q.is_correct
              ? "bg-green-100 text-green-700 hover:bg-green-200"
              : "bg-red-100 text-red-700 hover:bg-red-200";
          }
          if (q.is_bookmarked && !q.is_attempted) {
            bg = "bg-yellow-100 text-yellow-700 hover:bg-yellow-200";
          }
          if (isCurrent) {
            bg += " ring-2 ring-blue-500";
          }

          return (
            <button
              key={q.id}
              onClick={() => onSelect(idx)}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs font-medium transition-all ${bg}`}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
