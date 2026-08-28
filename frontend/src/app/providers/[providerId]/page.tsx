"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, errorMessage } from "@/lib/api-client";
import ExamCard from "@/components/exam/ExamCard";
import Spinner from "@/components/ui/Spinner";
import ErrorState from "@/components/ui/ErrorState";
import type { ProviderDetail } from "@/types";

export default function ProviderDetailPage() {
  const params = useParams();
  const providerId = Number(params.providerId);

  // State is tagged with the provider it belongs to, so a change of providerId
  // shows a spinner again instead of rendering the previous provider's data —
  // or, since a restricted provider now 404s, its stale error.
  const [data, setData] = useState<{ id: number; provider: ProviderDetail } | null>(null);
  const [failed, setFailed] = useState<{ id: number; message: string } | null>(null);

  useEffect(() => {
    if (!providerId) return;
    let cancelled = false;

    api
      .getProvider(providerId)
      .then((provider) => {
        if (!cancelled) setData({ id: providerId, provider });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFailed({ id: providerId, message: errorMessage(err, "Failed to load provider") });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  const provider = data?.id === providerId ? data.provider : null;
  const error = failed?.id === providerId ? failed.message : null;

  if (error) {
    return <ErrorState title="Provider unavailable" message={error} />;
  }
  if (!provider) return <Spinner className="mt-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">{provider.name}</h1>
      {provider.description && (
        <p className="text-gray-500 mt-1">{provider.description}</p>
      )}
      <h2 className="text-lg font-semibold text-gray-800 mt-6 mb-4">Exams</h2>
      {provider.exams.length === 0 ? (
        <p className="text-gray-500">No exams available.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {provider.exams.map((e) => (
            <ExamCard key={e.id} exam={e} />
          ))}
        </div>
      )}
    </div>
  );
}
