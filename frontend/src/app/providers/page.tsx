"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/context/AuthContext";
import ProviderCard from "@/components/exam/ProviderCard";
import Spinner from "@/components/ui/Spinner";
import type { Provider } from "@/types";

export default function ProvidersPage() {
  const { user, loading: authLoading } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    api.getProviders().then(setProviders).finally(() => setLoading(false));
  }, [user, authLoading]);

  if (authLoading || loading) return <Spinner className="mt-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cloud Providers</h1>
      {providers.length === 0 ? (
        <p className="text-gray-500">No providers found. Import some questions to get started.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </div>
  );
}
