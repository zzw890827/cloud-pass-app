"use client";

import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { HotspotRow, Option } from "@/types";

interface HotspotAnswerAreaProps {
  rows: HotspotRow[];
  /** The shared choice list every row's dropdown offers. */
  options: Option[];
  /** Index-aligned with `rows`; null means "not picked yet". */
  picks: (number | null)[];
  /** Omit to render read-only. */
  onChange?: (rowIndex: number, optionId: number) => void;
  /** Row-ordered answer key. Present => show per-row correct/wrong marks. */
  correctOptionIds?: number[];
}

export default function HotspotAnswerArea({
  rows,
  options,
  picks,
  onChange,
  correctOptionIds,
}: HotspotAnswerAreaProps) {
  const isReview = correctOptionIds !== undefined;
  const disabled = !onChange || isReview;
  const optionById = new Map(options.map((o) => [o.id, o]));

  return (
    <div className="rounded-lg border-2 border-gray-200 p-3 sm:p-4">
      <p className="font-semibold text-sm text-gray-700 mb-3">Answer Area</p>

      <div className="space-y-3">
        {rows.map((row, i) => {
          const pick = picks[i] ?? null;
          const correctId = isReview ? correctOptionIds[i] : undefined;
          const gotItRight = isReview && pick === correctId;
          // Derived from the same comparison as the detail block below, so the
          // border and the ✓/✗ can never disagree.
          const border = !isReview
            ? "border-gray-200"
            : gotItRight
              ? "border-green-500"
              : "border-red-500";
          const pickedOption = pick !== null ? optionById.get(pick) : undefined;
          const correctOption = correctId !== undefined ? optionById.get(correctId) : undefined;

          return (
            <div
              key={i}
              className={`grid grid-cols-1 sm:grid-cols-[1fr_auto] sm:items-center gap-2 sm:gap-4 border-l-4 pl-3 py-1 ${border}`}
            >
              <div className="text-sm text-gray-900">
                <MarkdownRenderer content={row.text} compact />
              </div>

              <div className="sm:w-64">
                <select
                  value={pick ?? ""}
                  disabled={disabled}
                  aria-label={`Answer for: ${row.text}`}
                  onChange={(e) => onChange?.(i, Number(e.target.value))}
                  className="w-full text-sm rounded-lg border-2 border-gray-200 bg-white px-3 py-2 disabled:bg-gray-50 disabled:text-gray-500 focus:border-accent-500 focus:outline-none"
                >
                  <option value="" disabled>
                    — Select —
                  </option>
                  {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}. {opt.option_text}
                    </option>
                  ))}
                </select>
              </div>

              {isReview && !gotItRight && (
                <div className="sm:col-span-2 text-xs space-y-0.5">
                  <p className="text-red-600">
                    {"✗"} Your answer:{" "}
                    {pickedOption ? `${pickedOption.label}. ${pickedOption.option_text}` : "(none)"}
                  </p>
                  <p className="text-green-600">
                    {"✓"} Correct:{" "}
                    {correctOption
                      ? `${correctOption.label}. ${correctOption.option_text}`
                      : "(unknown)"}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
