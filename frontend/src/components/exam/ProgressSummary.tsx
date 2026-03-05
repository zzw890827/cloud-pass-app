import ProgressBar from "@/components/ui/ProgressBar";
import type { ProgressSummary as ProgressSummaryType } from "@/types";

export default function ProgressSummary({ summary }: { summary: ProgressSummaryType }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Total" value={summary.total} />
        <StatBox label="Attempted" value={summary.attempted} />
        <StatBox label="Correct" value={summary.correct} color="text-green-600" />
        <StatBox label="Incorrect" value={summary.incorrect} color="text-red-600" />
      </div>
      <ProgressBar value={summary.attempted} max={summary.total} />
      {summary.correct > 0 && summary.attempted > 0 && (
        <p className="text-sm text-gray-500">
          Accuracy: {Math.round((summary.correct / summary.attempted) * 100)}%
        </p>
      )}
    </div>
  );
}

function StatBox({ label, value, color = "text-gray-900" }: { label: string; value: number; color?: string }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
