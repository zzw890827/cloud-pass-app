import MarkdownRenderer from "@/components/ui/MarkdownRenderer";
import type { OptionWithAnswer } from "@/types";

interface ExplanationPanelProps {
  isCorrect: boolean;
  explanation: string | null;
  options?: OptionWithAnswer[];
}

export default function ExplanationPanel({ isCorrect, explanation, options }: ExplanationPanelProps) {
  return (
    <div className="space-y-3">
      {/* Result + Explanation */}
      <div
        className={`p-4 rounded-lg border ${
          isCorrect ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
        }`}
      >
        <p className={`font-semibold text-sm ${isCorrect ? "text-green-700" : "text-red-700"}`}>
          {isCorrect ? "Correct!" : "Incorrect"}
        </p>
        {explanation && (
          <div className="text-sm text-gray-700 mt-2">
            <MarkdownRenderer content={explanation} />
          </div>
        )}
      </div>

      {/* Per-option breakdown */}
      {options && options.length > 0 && (
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 mb-2">Options Breakdown</p>
          <div className="space-y-1.5">
            {options.map((opt) => (
              <div key={opt.id} className="flex items-start gap-2 text-sm">
                <span className={`flex-shrink-0 font-medium ${opt.is_correct ? "text-green-600" : "text-red-500"}`}>
                  {opt.is_correct ? "\u2713" : "\u2717"} {opt.label}.
                </span>
                <span className={opt.is_correct ? "text-gray-900" : "text-gray-500"}>
                  <MarkdownRenderer content={opt.option_text} compact />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
