"use client";

import { api } from "@/lib/api-client";

interface BookmarkButtonProps {
  questionId: number;
  bookmarked: boolean;
  onToggle: (val: boolean) => void;
}

export default function BookmarkButton({ questionId, bookmarked, onToggle }: BookmarkButtonProps) {
  const toggle = async () => {
    try {
      if (bookmarked) {
        await api.removeBookmark(questionId);
        onToggle(false);
      } else {
        await api.addBookmark(questionId);
        onToggle(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
      title={bookmarked ? "Remove bookmark" : "Add bookmark"}
    >
      <svg
        className={`w-5 h-5 ${bookmarked ? "text-yellow-500 fill-yellow-500" : "text-gray-400"}`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        fill={bookmarked ? "currentColor" : "none"}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    </button>
  );
}
