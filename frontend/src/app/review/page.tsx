"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import QuestionCard from "@/components/question/QuestionCard";
import Spinner from "@/components/ui/Spinner";
import type { Bookmark, Question, Exam } from "@/types";

export default function ReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | undefined>(undefined);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQ, setLoadingQ] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    api.getExams().then(setExams);
  }, [user, authLoading]);

  useEffect(() => {
    if (authLoading || !user) return;
    setLoading(true);
    api.getBookmarks(selectedExamId).then((bms) => {
      setBookmarks(bms);
      setCurrentIdx(0);
      setCurrentQ(null);
      setLoading(false);
    });
  }, [selectedExamId, user, authLoading]);

  const loadQuestion = useCallback(async (questionId: number) => {
    setLoadingQ(true);
    try {
      setCurrentQ(await api.getQuestion(questionId));
    } finally {
      setLoadingQ(false);
    }
  }, []);

  useEffect(() => {
    if (bookmarks.length > 0 && bookmarks[currentIdx]) {
      loadQuestion(bookmarks[currentIdx].question_id);
    }
  }, [currentIdx, bookmarks, loadQuestion]);

  if (authLoading || loading) return <Spinner className="mt-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Review Bookmarks</h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          className="w-full sm:w-auto border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          value={selectedExamId ?? ""}
          onChange={(e) => setSelectedExamId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All Exams</option>
          {exams.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.code} - {ex.name}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">{bookmarks.length} bookmarked</span>
      </div>

      {bookmarks.length === 0 ? (
        <p className="text-gray-500">No bookmarked questions. Bookmark questions during practice to review them here.</p>
      ) : (
        <div>
          <Card className="p-6">
            {loadingQ || !currentQ ? (
              <Spinner className="py-10" />
            ) : (
              <QuestionCard question={currentQ} />
            )}
          </Card>
          <div className="flex items-center justify-between mt-4">
            <Button
              variant="secondary"
              onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
              disabled={currentIdx === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              {currentIdx + 1} / {bookmarks.length}
            </span>
            <Button
              variant="secondary"
              onClick={() => setCurrentIdx(Math.min(bookmarks.length - 1, currentIdx + 1))}
              disabled={currentIdx === bookmarks.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
