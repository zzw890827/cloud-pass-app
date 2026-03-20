"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import QuestionCard from "@/components/question/QuestionCard";
import QuestionNavigator from "@/components/question/QuestionNavigator";
import Spinner from "@/components/ui/Spinner";
import type { Question, QuestionListItem } from "@/types";

const API_PER_PAGE = 200;

export default function PracticePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const examId = Number(params.examId);
  const initialQuestionId = searchParams.get("questionId");
  const initialIdxSet = useRef(false);

  const [questions, setQuestions] = useState<QuestionListItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQ, setLoadingQ] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  // Pagination state for API-level pages (200 per page)
  const [apiPage, setApiPage] = useState(1);
  const [totalApiPages, setTotalApiPages] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingPage = useRef<number | null>(null);

  // Load first page of questions
  useEffect(() => {
    if (!examId) return;
    api.getQuestions(examId, 1, API_PER_PAGE).then((page) => {
      setQuestions(page.items);
      setApiPage(1);
      setTotalApiPages(page.total_pages);
      setTotalQuestions(page.total);
      if (initialQuestionId && !initialIdxSet.current) {
        const idx = page.items.findIndex((q) => q.id === Number(initialQuestionId));
        if (idx !== -1) setCurrentIdx(idx);
        initialIdxSet.current = true;
      }
      setLoading(false);
    });
  }, [examId, initialQuestionId]);

  // Auto-fetch next API page when user reaches the last navigator page (50-item page)
  // of currently loaded questions
  const loadNextApiPage = useCallback(async () => {
    const nextPage = apiPage + 1;
    if (nextPage > totalApiPages || fetchingPage.current === nextPage) return;
    fetchingPage.current = nextPage;
    setLoadingMore(true);
    try {
      const page = await api.getQuestions(examId, nextPage, API_PER_PAGE);
      setQuestions((prev) => [...prev, ...page.items]);
      setApiPage(nextPage);
    } finally {
      setLoadingMore(false);
      fetchingPage.current = null;
    }
  }, [examId, apiPage, totalApiPages]);

  // Trigger load when user navigates into the last navigator page (last 50) of loaded questions
  useEffect(() => {
    if (apiPage >= totalApiPages) return;
    const lastNavPageStart = Math.floor((questions.length - 1) / 50) * 50;
    if (currentIdx >= lastNavPageStart) {
      loadNextApiPage();
    }
  }, [currentIdx, questions.length, apiPage, totalApiPages, loadNextApiPage]);

  // Load current question detail
  const loadQuestion = useCallback(async (questionId: number) => {
    setLoadingQ(true);
    try {
      const q = await api.getQuestion(questionId);
      setCurrentQ(q);
    } finally {
      setLoadingQ(false);
    }
  }, []);

  useEffect(() => {
    if (questions.length > 0 && questions[currentIdx]) {
      loadQuestion(questions[currentIdx].id);
    }
  }, [currentIdx, questions, loadQuestion]);

  const handleAnswered = (isCorrect: boolean) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === currentIdx ? { ...q, is_attempted: true, is_correct: isCorrect } : q
      )
    );
  };

  const pendingNextRef = useRef(false);

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else if (apiPage < totalApiPages) {
      loadNextApiPage();
      pendingNextRef.current = true;
    }
  };

  // Auto-advance after new questions are appended
  useEffect(() => {
    if (pendingNextRef.current && currentIdx < questions.length - 1) {
      pendingNextRef.current = false;
      setCurrentIdx(currentIdx + 1);
    }
  }, [questions.length, currentIdx]);

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleNavSelect = (idx: number) => {
    setCurrentIdx(idx);
    setNavOpen(false);
  };

  const attempted = questions.filter((q) => q.is_attempted).length;

  if (loading) return <Spinner className="mt-20" />;

  if (questions.length === 0) {
    return <p className="text-gray-500 mt-10">No questions available for this exam.</p>;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {/* Mobile collapsible navigator */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700"
          >
            <span>Questions ({attempted}/{totalQuestions})</span>
            <svg
              className={`w-4 h-4 transition-transform ${navOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {navOpen && (
            <Card className="p-3 mt-2">
              <QuestionNavigator
                questions={questions}
                currentIndex={currentIdx}
                onSelect={handleNavSelect}
                totalQuestions={totalQuestions}
              />
            </Card>
          )}
        </div>

        <Card className="p-4 sm:p-6">
          {loadingQ || !currentQ ? (
            <Spinner className="py-10" />
          ) : (
            <QuestionCard question={currentQ} onAnswered={handleAnswered} />
          )}
        </Card>

        <div className="flex items-center justify-between mt-4">
          <Button variant="secondary" onClick={goPrev} disabled={currentIdx === 0}>
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            {currentIdx + 1} / {totalQuestions}
            {loadingMore && " (loading…)"}
          </span>
          <Button variant="secondary" onClick={goNext} disabled={currentIdx === questions.length - 1 && apiPage >= totalApiPages}>
            Next
          </Button>
        </div>
      </div>

      {/* Desktop sidebar navigator */}
      <div className="hidden lg:block lg:w-64 flex-shrink-0">
        <Card className="p-4 sticky top-20">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Questions</h3>
          <QuestionNavigator
            questions={questions}
            currentIndex={currentIdx}
            onSelect={setCurrentIdx}
            totalQuestions={totalQuestions}
          />
        </Card>
      </div>
    </div>
  );
}
