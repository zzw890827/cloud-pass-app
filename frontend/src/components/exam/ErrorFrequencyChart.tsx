"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useRouter } from "next/navigation";
import type { QuestionErrorFrequency } from "@/types";

interface ErrorFrequencyChartProps {
  items: QuestionErrorFrequency[];
  examId: number;
}

interface ChartDataItem {
  external_id: string;
  question_id: number;
  errors: number;
  correct: number;
  attempts: number;
  error_rate: number;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartDataItem }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded shadow-sm p-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{item.external_id}</p>
      <p className="text-red-600">Errors: {item.errors}</p>
      <p className="text-gray-600">Attempts: {item.attempts}</p>
      <p className="text-gray-600">Error Rate: {Math.round(item.error_rate * 100)}%</p>
    </div>
  );
}

interface CustomTickProps {
  x?: string | number;
  y?: string | number;
  payload?: { value: string };
  data: ChartDataItem[];
  examId: number;
  onNavigate: (questionId: number) => void;
}

function CustomYAxisTick({ x = 0, y = 0, payload, data, onNavigate }: CustomTickProps) {
  if (!payload) return null;
  const item = data.find((d) => d.external_id === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={4}
        textAnchor="end"
        fill="#2563eb"
        fontSize={12}
        style={{ cursor: "pointer", textDecoration: "underline" }}
        onClick={() => item && onNavigate(item.question_id)}
      >
        {payload.value}
      </text>
    </g>
  );
}

export default function ErrorFrequencyChart({ items, examId }: ErrorFrequencyChartProps) {
  const router = useRouter();

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No errors recorded yet.</p>;
  }

  const data: ChartDataItem[] = items.map((item) => ({
    external_id: item.external_id,
    question_id: item.question_id,
    errors: item.error_count,
    correct: item.attempt_count - item.error_count,
    attempts: item.attempt_count,
    error_rate: item.error_rate,
  }));

  const handleNavigate = (questionId: number) => {
    router.push(`/exams/${examId}/practice?questionId=${questionId}`);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleBarClick = (barData: any) => {
    const questionId = barData?.activePayload?.[0]?.payload?.question_id;
    if (questionId) handleNavigate(questionId);
  };

  const chartHeight = Math.max(200, items.length * 44);

  return (
    <div style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 20, left: 70, bottom: 0 }}
          onClick={handleBarClick}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="external_id"
            width={65}
            tick={(props) => (
              <CustomYAxisTick
                {...props}
                data={data}
                examId={examId}
                onNavigate={handleNavigate}
              />
            )}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Bar dataKey="errors" stackId="a" fill="#ef4444" name="Errors" />
          <Bar
            dataKey="correct"
            stackId="a"
            fill="#22c55e"
            name="Correct"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 justify-end">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
          Errors
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          Correct
        </span>
      </div>
    </div>
  );
}
