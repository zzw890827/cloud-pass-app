"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { Provider } from "@/types";

export default function ProviderCard({ provider }: { provider: Provider }) {
  const router = useRouter();

  return (
    <Card onClick={() => router.push(`/providers/${provider.id}`)} className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{provider.name}</h3>
          {provider.description && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{provider.description}</p>
          )}
        </div>
        <Badge color="blue">{provider.exam_count} exams</Badge>
      </div>
    </Card>
  );
}
