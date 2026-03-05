"use client";

import type { ExamSessionQuestionListItem } from "@/types";

interface ExamNavigatorProps {
  questions: ExamSessionQuestionListItem[];
  currentIndex: number;
  onSelect: (index: number) => void;
}

export default function ExamNavigator({ questions, currentIndex, onSelect }: ExamNavigatorProps) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-1.5">
      {questions.map((q) => {
        const isCurrent = q.order_index === currentIndex;
        let bg = "bg-gray-100 text-gray-600 hover:bg-gray-200"; // unanswered
        if (q.is_answered) {
          bg = "bg-blue-100 text-blue-700 hover:bg-blue-200"; // answered
        }
        if (isCurrent) {
          bg += " ring-2 ring-blue-500";
        }

        return (
          <button
            key={q.id}
            onClick={() => onSelect(q.order_index)}
            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs font-medium transition-all ${bg}`}
          >
            {q.order_index + 1}
          </button>
        );
      })}
    </div>
  );
}
