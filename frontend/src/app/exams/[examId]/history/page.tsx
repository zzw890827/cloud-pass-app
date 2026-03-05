"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ScoreChart from "@/components/exam/ScoreChart";
import ErrorFrequencyTable from "@/components/exam/ErrorFrequencyTable";
import Spinner from "@/components/ui/Spinner";
import type { ExamSessionHistory, ExamErrorReport } from "@/types";

export default function ExamHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.examId);

  const [history, setHistory] = useState<ExamSessionHistory | null>(null);
  const [errorReport, setErrorReport] = useState<ExamErrorReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;
    Promise.all([
      api.getSessionHistory(examId),
      api.getErrorReport(examId),
    ]).then(([h, e]) => {
      setHistory(h);
      setErrorReport(e);
    }).finally(() => setLoading(false));
  }, [examId]);

  if (loading || !history || !errorReport) return <Spinner className="mt-20" />;

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
        <ErrorFrequencyTable items={errorReport.items} />
      </Card>

      <div className="mt-6">
        <Button variant="secondary" onClick={() => router.push(`/exams/${examId}`)}>
          Back to Exam
        </Button>
      </div>
    </div>
  );
}
