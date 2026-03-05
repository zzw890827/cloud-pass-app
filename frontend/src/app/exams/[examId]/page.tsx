"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressSummaryComponent from "@/components/exam/ProgressSummary";
import Spinner from "@/components/ui/Spinner";
import type { Exam } from "@/types";

export default function ExamOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const id = Number(params.examId);
    if (!id) return;
    api.getExam(id).then(setExam).finally(() => setLoading(false));
  }, [params.examId]);

  const handleReset = async () => {
    if (!exam) return;
    if (!confirm("Reset all progress for this exam?")) return;
    await api.resetProgress(exam.id);
    const updated = await api.getExam(exam.id);
    setExam(updated);
  };

  const handleStartExam = async () => {
    if (!exam || starting) return;
    setStarting(true);
    try {
      const session = await api.createExamSession(exam.id);
      router.push(`/exams/${exam.id}/exam/${session.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to start exam";
      alert(msg);
    } finally {
      setStarting(false);
    }
  };

  if (loading || !exam) return <Spinner className="mt-20" />;

  const hasActiveSession = !!exam.active_session_id;

  return (
    <div className="max-w-2xl">
      <p className="text-xs font-mono text-gray-400 uppercase">{exam.code}</p>
      <h1 className="text-2xl font-bold text-gray-900 mt-1">{exam.name}</h1>
      <p className="text-sm text-gray-500 mt-1">{exam.provider_name}</p>
      {exam.description && (
        <p className="text-gray-600 mt-3">{exam.description}</p>
      )}

      {/* Exam config */}
      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Exam Configuration</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{exam.num_questions}</div>
            <div className="text-xs text-gray-500">Questions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{exam.pass_percentage}%</div>
            <div className="text-xs text-gray-500">Pass Mark</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{exam.time_limit_minutes}</div>
            <div className="text-xs text-gray-500">Minutes</div>
          </div>
        </div>
      </Card>

      {exam.progress_summary && (
        <Card className="p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Practice Progress</h2>
          <ProgressSummaryComponent summary={exam.progress_summary} />
        </Card>
      )}

      <div className="flex flex-wrap gap-3 mt-6">
        {/* Exam mode */}
        {hasActiveSession ? (
          <Button onClick={() => router.push(`/exams/${exam.id}/exam/${exam.active_session_id}`)}>
            Resume Exam
          </Button>
        ) : (
          <Button onClick={handleStartExam} disabled={starting}>
            {starting ? "Starting..." : "Start Exam"}
          </Button>
        )}

        {/* Practice mode */}
        <Button variant="secondary" onClick={() => router.push(`/exams/${exam.id}/practice`)}>
          {exam.progress_summary && exam.progress_summary.attempted > 0
            ? "Continue Practice"
            : "Start Practice"}
        </Button>

        {/* History */}
        <Button variant="ghost" onClick={() => router.push(`/exams/${exam.id}/history`)}>
          Exam History
        </Button>

        {exam.progress_summary && exam.progress_summary.attempted > 0 && (
          <Button variant="danger" onClick={handleReset}>
            Reset Progress
          </Button>
        )}
      </div>
    </div>
  );
}
