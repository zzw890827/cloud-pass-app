"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { ExamSessionHistoryItem } from "@/types";

interface ScoreChartProps {
  items: ExamSessionHistoryItem[];
  passPercentage: number;
}

export default function ScoreChart({ items, passPercentage }: ScoreChartProps) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No completed exams yet.</p>;
  }

  const data = items.map((item, idx) => ({
    attempt: idx + 1,
    score: item.score ?? 0,
    date: item.completed_at
      ? new Date(item.completed_at).toLocaleDateString()
      : "",
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="attempt" label={{ value: "Attempt", position: "insideBottom", offset: -3 }} />
        <YAxis domain={[0, 100]} label={{ value: "Score %", angle: -90, position: "insideLeft" }} />
        <Tooltip
          formatter={(value: number | undefined) => [`${value ?? 0}%`, "Score"]}
          labelFormatter={(label) => `Attempt ${label}`}
        />
        <ReferenceLine
          y={passPercentage}
          stroke="#ef4444"
          strokeDasharray="5 5"
          label={{ value: `Pass ${passPercentage}%`, fill: "#ef4444", fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
