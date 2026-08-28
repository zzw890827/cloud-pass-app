"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Input from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import type { Exam, DeleteExamResult } from "@/types";

export default function MaintenancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-exam UI state
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [visibilityId, setVisibilityId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DeleteExamResult | null>(null);

  useEffect(() => {
    if (authLoading || !user?.is_admin) return;
    api
      .getExams()
      .then(setExams)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load exams")
      )
      .finally(() => setLoading(false));
  }, [user, authLoading]);

  const startConfirm = (examId: number) => {
    setConfirmingId(examId);
    setConfirmText("");
    setError("");
    setResult(null);
  };

  const cancelConfirm = () => {
    setConfirmingId(null);
    setConfirmText("");
  };

  const toggleVisibility = async (exam: Exam) => {
    const next = !exam.is_public;
    setError("");
    setVisibilityId(exam.id);
    try {
      await api.updateExamVisibility(exam.id, next);
      setExams((prev) =>
        prev.map((e) => (e.id === exam.id ? { ...e, is_public: next } : e))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update visibility");
    } finally {
      setVisibilityId(null);
    }
  };

  const handleDelete = async (exam: Exam) => {
    if (confirmText !== exam.code) return;
    setDeletingId(exam.id);
    setError("");
    setResult(null);
    try {
      const res = await api.deleteExam(exam.id);
      setResult(res);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      setConfirmingId(null);
      setConfirmText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) {
    return <Spinner className="mt-20" />;
  }

  if (!user?.is_admin) {
    return <p className="text-red-500 mt-10">Admin access required.</p>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
        <Link href="/admin/users" className="text-sm text-accent-600 hover:underline">
          User Management
        </Link>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Set who may take each exam, or delete an exam and all of its related data (questions,
        options, sessions, answers, and bookmarks). Deleting cannot be undone.
      </p>

      {result && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">
            Deleted <span className="font-semibold">{result.code}</span> —{" "}
            {result.questions_deleted} questions, {result.sessions_deleted} sessions.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <Spinner className="mt-10" />
      ) : exams.length === 0 ? (
        <p className="text-sm text-gray-500">No exams found.</p>
      ) : (
        <div className="space-y-3">
          {exams.map((exam) => {
            const isConfirming = confirmingId === exam.id;
            const isDeleting = deletingId === exam.id;
            return (
              <Card key={exam.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{exam.code}</span>
                      <Badge>{exam.total_questions} Q</Badge>
                      <Badge color={exam.is_public ? "green" : "yellow"}>
                        {exam.is_public ? "Public" : "Restricted"}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 truncate">{exam.name}</p>
                    <p className="text-xs text-gray-400">{exam.provider_name}</p>
                  </div>
                  {!isConfirming && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleVisibility(exam)}
                        disabled={visibilityId === exam.id}
                        title={
                          exam.is_public
                            ? "Restrict to granted users only"
                            : "Open to every user"
                        }
                      >
                        {visibilityId === exam.id
                          ? "Saving..."
                          : exam.is_public
                            ? "Restrict"
                            : "Make public"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => router.push(`/admin/questions/${exam.id}`)}
                      >
                        Questions
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => startConfirm(exam.id)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </div>

                {isConfirming && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    <p className="text-sm text-gray-700">
                      Type{" "}
                      <code className="px-1.5 py-0.5 bg-gray-100 rounded text-red-600 font-mono">
                        {exam.code}
                      </code>{" "}
                      to confirm permanent deletion.
                    </p>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={exam.code}
                      autoFocus
                      disabled={isDeleting}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDelete(exam)}
                        disabled={confirmText !== exam.code || isDeleting}
                      >
                        {isDeleting ? "Deleting..." : "Confirm delete"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelConfirm}
                        disabled={isDeleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
