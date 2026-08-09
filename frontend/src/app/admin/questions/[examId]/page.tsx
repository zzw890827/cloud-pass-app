"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import QuestionWeightRow from "@/components/admin/QuestionWeightRow";
import type { QuestionWeightPage } from "@/types";

const PER_PAGE = 50;

export default function QuestionWeightsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const examId = Number(params.examId);

  const [data, setData] = useState<QuestionWeightPage | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user?.is_admin || !Number.isInteger(examId)) return;
    let cancelled = false;

    api.getQuestionWeights(examId, page, PER_PAGE)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setError("");
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load questions");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examId, page, user, authLoading]);

  // Keep the local copy in step so the badges and counts match what was saved.
  const handleSaved = useCallback((questionId: number, weight: number) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            items: prev.items.map((q) => (q.id === questionId ? { ...q, weight } : q)),
          }
        : prev
    );
  }, []);

  if (authLoading) return <Spinner className="mt-20" />;
  if (!user?.is_admin) return <p className="text-red-500 mt-10">Admin access required.</p>;
  // `loading` never clears for an invalid id, so check that first.
  if (!Number.isInteger(examId)) {
    return <p className="text-red-500 mt-10">Invalid exam id.</p>;
  }
  // Paging keeps the old rows mounted otherwise, with stale local weights —
  // but never spin on a page whose request already failed.
  if (!error && (loading || (data && data.page !== page))) {
    return <Spinner className="mt-20" />;
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-gray-900">Question Weights</h1>
        <p className="text-sm text-red-600 mt-4">{error || "Failed to load questions."}</p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => router.push("/admin/maintenance")}>
            Back to Maintenance
          </Button>
        </div>
      </div>
    );
  }

  const excluded = data.items.filter((q) => q.weight === 0).length;
  const always = data.items.filter((q) => q.weight === 100).length;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900">Question Weights</h1>
      <p className="text-sm text-gray-500 mt-1">
        {data.exam_code} — {data.exam_name}
      </p>

      <Card className="p-4 mt-6">
        <p className="text-sm text-gray-600">
          The weight decides how likely a question is to be drawn into an exam session.{" "}
          <span className="font-medium text-gray-900">50</span> is the default and leaves selection
          as it would be otherwise; higher or lower scales the question&apos;s chance up or down.{" "}
          <span className="font-medium text-gray-900">0</span> never draws it,{" "}
          <span className="font-medium text-gray-900">100</span> always does. Every other factor —
          unseen questions, past mistakes, bookmarks, forgetting curve — still applies in between.
        </p>
        <p className="text-sm text-gray-600 mt-2">
          Questions set to 100 take their slots first, ahead of any content-domain quotas, so
          marking many of them shifts the domain mix of a session. If weights leave fewer questions
          than the exam asks for, a session is built from what remains and scored out of that.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Changes save automatically. Showing {data.items.length} of {data.total} questions
          {excluded > 0 && ` · ${excluded} never drawn on this page`}
          {always > 0 && ` · ${always} always drawn on this page`}
        </p>
      </Card>

      <Card className="p-4 mt-4">
        <ul>
          {data.items.map((q) => (
            <QuestionWeightRow key={q.id} question={q} onSaved={handleSaved} />
          ))}
        </ul>
      </Card>

      {data.total_pages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {data.page} / {data.total_pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={data.page >= data.total_pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={() => router.push("/admin/maintenance")}>
          Back to Maintenance
        </Button>
      </div>
    </div>
  );
}
