"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { ExamBrief } from "@/types";

export default function ExamCard({ exam }: { exam: ExamBrief }) {
  const router = useRouter();

  return (
    <Card onClick={() => router.push(`/exams/${exam.id}`)} className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-gray-400 uppercase">{exam.code}</p>
          <h4 className="text-base font-medium text-gray-900 mt-0.5">{exam.name}</h4>
        </div>
        <Badge color="gray">{exam.total_questions} Q</Badge>
      </div>
    </Card>
  );
}
