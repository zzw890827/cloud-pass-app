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
  /** Heading over the statements column, e.g. "Statements:". */
  rowHeader?: string | null;
  /** Heading over the dropdown column, e.g. "Select Yes or No:". */
  choiceHeader?: string | null;
}

export default function HotspotAnswerArea({
  rows,
  options,
  picks,
  onChange,
  correctOptionIds,
  rowHeader,
  choiceHeader,
}: HotspotAnswerAreaProps) {
  const isReview = correctOptionIds !== undefined;
  const disabled = !onChange || isReview;
  const optionById = new Map(options.map((o) => [o.id, o]));
  const hasHeaders = Boolean(rowHeader || choiceHeader);
  // The unpicked state shows the choices themselves — "Yes / No" — the way the
  // real exams do, so a candidate can see what a row is asking without opening
  // the dropdown.
  const placeholder = options.map((o) => o.option_text).join(" / ");

  return (
    <div className="rounded-lg border-2 border-gray-200 p-3 sm:p-4">
      <p className="font-semibold text-sm text-gray-700 mb-3">Answer Area</p>

      {hasHeaders && (
        <div
          // border-l-4 transparent mirrors the data rows' correctness stripe so
          // the two columns line up under their headings.
          className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 sm:gap-4 border-l-4 border-transparent pl-3 pb-2 mb-1"
        >
          <p className="font-semibold text-sm text-gray-900">{rowHeader}</p>
          <p className="sm:w-64 font-semibold text-sm text-gray-900">{choiceHeader}</p>
        </div>
      )}

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
                    {placeholder}
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
