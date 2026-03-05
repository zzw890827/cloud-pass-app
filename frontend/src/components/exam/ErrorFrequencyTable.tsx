"use client";

import type { QuestionErrorFrequency } from "@/types";

interface ErrorFrequencyTableProps {
  items: QuestionErrorFrequency[];
}

export default function ErrorFrequencyTable({ items }: ErrorFrequencyTableProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No errors recorded yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-3 font-medium text-gray-700">Question</th>
            <th className="text-right py-2 px-3 font-medium text-gray-700">Errors</th>
            <th className="text-right py-2 px-3 font-medium text-gray-700">Attempts</th>
            <th className="text-right py-2 px-3 font-medium text-gray-700">Error Rate</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.question_id} className="border-b border-gray-100">
              <td className="py-2 px-3 font-mono text-blue-600">{item.external_id}</td>
              <td className="py-2 px-3 text-right text-red-600 font-medium">{item.error_count}</td>
              <td className="py-2 px-3 text-right text-gray-600">{item.attempt_count}</td>
              <td className="py-2 px-3 text-right text-gray-600">{Math.round(item.error_rate * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
