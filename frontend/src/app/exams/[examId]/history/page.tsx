"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ScoreChart from "@/components/exam/ScoreChart";
import ErrorFrequencyChart from "@/components/exam/ErrorFrequencyChart";
import UnusedQuestionsList from "@/components/exam/UnusedQuestionsList";
import Spinner from "@/components/ui/Spinner";
import type { ExamSessionHistory, ExamErrorReport, ExamUnusedQuestions } from "@/types";

export default function ExamHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.examId);

  // State is tagged with the exam it belongs to, so a change of examId shows a
  // spinner again instead of briefly rendering the previous exam's data.
  const [data, setData] = useState<{
    examId: number;
    history: ExamSessionHistory;
    errorReport: ExamErrorReport;
  } | null>(null);
  const [failedExamId, setFailedExamId] = useState<number | null>(null);
  const [unused, setUnused] = useState<{
    examId: number;
    report: ExamUnusedQuestions;
  } | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;

    Promise.all([
      api.getSessionHistory(examId),
      api.getErrorReport(examId),
    ]).then(([h, e]) => {
      if (!cancelled) setData({ examId, history: h, errorReport: e });
    }).catch(() => {
      if (!cancelled) setFailedExamId(examId);
    });

    // Supplementary panel — fetched separately so a failure here cannot take
    // down the rest of the history page.
    api.getUnusedQuestions(examId)
      .then((report) => {
        if (!cancelled) setUnused({ examId, report });
      })
      .catch((err) => {
        console.error("Failed to load never-drawn questions", err);
      });

    return () => {
      cancelled = true;
    };
  }, [examId]);

  const history = data?.examId === examId ? data.history : null;
  const errorReport = data?.examId === examId ? data.errorReport : null;
  const unusedQuestions = unused?.examId === examId ? unused.report : null;

  if (failedExamId !== examId && (!history || !errorReport)) {
    return <Spinner className="mt-20" />;
  }

  if (!history || !errorReport) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Exam History</h1>
        <p className="text-sm text-red-600 mt-4">
          Failed to load exam history. Please try again.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => router.push(`/exams/${examId}`)}>
            Back to Exam
          </Button>
        </div>
      </div>
    );
  }

  const passPercentage = history.items.length > 0
    ? history.items[0].pass_percentage
    : 75;

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Exam History</h1>
      <p className="text-sm text-gray-500 mt-1">
        {history.exam_code} — {history.exam_name}
      </p>

      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Score Trend</h2>
        <ScoreChart items={history.items} passPercentage={passPercentage} />
      </Card>

      {/* History table */}
      {history.items.length > 0 && (
        <Card className="p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Past Attempts</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 font-medium text-gray-700">#</th>
                  <th className="text-left py-2 px-3 font-medium text-gray-700">Date</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Score</th>
                  <th className="text-right py-2 px-3 font-medium text-gray-700">Correct</th>
                  <th className="text-center py-2 px-3 font-medium text-gray-700">Result</th>
                </tr>
              </thead>
              <tbody>
                {history.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-b border-gray-100 cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/exams/${examId}/exam/${item.id}/result`)}
                  >
                    <td className="py-2 px-3 text-gray-600">{idx + 1}</td>
                    <td className="py-2 px-3 text-gray-600">
                      {item.completed_at
                        ? new Date(item.completed_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-medium">
                      {item.score?.toFixed(1)}%
                    </td>
                    <td className="py-2 px-3 text-right text-gray-600">
                      {item.correct_count}/{item.num_questions}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs font-medium ${item.passed ? "text-green-600" : "text-red-600"}`}>
                        {item.passed ? "PASS" : "FAIL"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="p-5 mt-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Error Frequency</h2>
        <ErrorFrequencyChart items={errorReport.items} examId={examId} />
      </Card>

      {unusedQuestions && (
        <Card className="p-5 mt-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Never Drawn in an Exam</h2>
          <UnusedQuestionsList report={unusedQuestions} examId={examId} />
        </Card>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={() => router.push(`/exams/${examId}`)}>
          Back to Exam
        </Button>
      </div>
    </div>
  );
}
