"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";
import ExamCard from "@/components/exam/ExamCard";
import Spinner from "@/components/ui/Spinner";
import type { ProviderDetail } from "@/types";

export default function ProviderDetailPage() {
  const params = useParams();
  const [provider, setProvider] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = Number(params.providerId);
    if (!id) return;
    api.getProvider(id).then(setProvider).finally(() => setLoading(false));
  }, [params.providerId]);

  if (loading || !provider) return <Spinner className="mt-20" />;

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
