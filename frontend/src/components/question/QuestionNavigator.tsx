"use client";

import type { QuestionListItem } from "@/types";

interface QuestionNavigatorProps {
  questions: QuestionListItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function QuestionNavigator({ questions, currentIndex, onSelect }: QuestionNavigatorProps) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-1.5">
      {questions.map((q, idx) => {
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
  );
}
