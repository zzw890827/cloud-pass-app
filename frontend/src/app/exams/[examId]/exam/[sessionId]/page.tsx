"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ExamQuestionCard from "@/components/exam/ExamQuestionCard";
import ExamNavigator from "@/components/exam/ExamNavigator";
import ExamTimer from "@/components/exam/ExamTimer";
import Spinner from "@/components/ui/Spinner";
import type { ExamSession, ExamSessionQuestionDetail } from "@/types";

export default function ExamSessionPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.examId);
  const sessionId = Number(params.sessionId);

  const [session, setSession] = useState<ExamSession | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [currentQ, setCurrentQ] = useState<ExamSessionQuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingQ, setLoadingQ] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    api.getExamSession(sessionId).then((s) => {
      if (s.status !== "in_progress") {
        router.replace(`/exams/${examId}/exam/${sessionId}/result`);
        return;
      }
      setSession(s);
      setLoading(false);
    });
  }, [sessionId, examId, router]);

  const loadQuestion = useCallback(async (idx: number) => {
    setLoadingQ(true);
    try {
      const q = await api.getSessionQuestion(sessionId, idx);
      setCurrentQ(q);
    } finally {
      setLoadingQ(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (session) {
      loadQuestion(currentIdx);
    }
  }, [currentIdx, session, loadQuestion]);

  const handleSubmitAnswer = useCallback(async (selectedOptionIds: number[]) => {
    await api.submitSessionAnswer(sessionId, currentIdx, selectedOptionIds);
    // Update local session question state
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        questions: prev.questions.map((q) =>
          q.order_index === currentIdx ? { ...q, is_answered: true } : q
        ),
      };
    });
  }, [sessionId, currentIdx]);

  const handleComplete = async () => {
    if (!session) return;
    const answered = session.questions.filter((q) => q.is_answered).length;
    const unanswered = session.questions.length - answered;
    const msg = unanswered > 0
      ? `You have ${unanswered} unanswered question(s). Submit exam?`
      : "Submit exam?";
    if (!confirm(msg)) return;
    await api.completeExamSession(sessionId);
    router.push(`/exams/${examId}/exam/${sessionId}/result`);
  };

  const handleAbandon = async () => {
    if (!confirm("Abandon this exam? Your progress will be lost.")) return;
    await api.abandonExamSession(sessionId);
    router.push(`/exams/${examId}`);
  };

  const handleTimeUp = useCallback(async () => {
    await api.completeExamSession(sessionId);
    router.push(`/exams/${examId}/exam/${sessionId}/result`);
  }, [sessionId, examId, router]);

  const goNext = () => {
    if (session && currentIdx < session.questions.length - 1) setCurrentIdx(currentIdx + 1);
  };

  const goPrev = () => {
    if (currentIdx > 0) setCurrentIdx(currentIdx - 1);
  };

  const handleNavSelect = (idx: number) => {
    setCurrentIdx(idx);
    setNavOpen(false);
  };

  if (loading || !session) return <Spinner className="mt-20" />;

  const answered = session.questions.filter((q) => q.is_answered).length;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {answered}/{session.questions.length} answered
            </span>
            <ExamTimer
              startedAt={session.started_at}
              timeLimitMinutes={session.time_limit_minutes}
              onTimeUp={handleTimeUp}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleAbandon}>
              Abandon
            </Button>
            <Button variant="success" size="sm" onClick={handleComplete}>
              Submit Exam
            </Button>
          </div>
        </div>

        {/* Mobile collapsible navigator */}
        <div className="lg:hidden mb-4">
          <button
            onClick={() => setNavOpen(!navOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700"
          >
            <span>Questions ({answered}/{session.questions.length})</span>
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
              <ExamNavigator
                questions={session.questions}
                currentIndex={currentIdx}
                onSelect={handleNavSelect}
              />
            </Card>
          )}
        </div>

        <Card className="p-4 sm:p-6">
          {loadingQ || !currentQ ? (
            <Spinner className="py-10" />
          ) : (
            <ExamQuestionCard question={currentQ} onSubmit={handleSubmitAnswer} />
          )}
        </Card>

        <div className="flex items-center justify-between mt-4">
          <Button variant="secondary" onClick={goPrev} disabled={currentIdx === 0}>
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            {currentIdx + 1} / {session.questions.length}
          </span>
          <Button variant="secondary" onClick={goNext} disabled={currentIdx === session.questions.length - 1}>
            Next
          </Button>
        </div>
      </div>

      {/* Desktop sidebar navigator */}
      <div className="hidden lg:block lg:w-64 flex-shrink-0">
        <Card className="p-4 sticky top-20">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Questions</h3>
          <ExamNavigator
            questions={session.questions}
            currentIndex={currentIdx}
            onSelect={setCurrentIdx}
          />
        </Card>
      </div>
    </div>
  );
}
