"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import Badge from "@/components/ui/Badge";
import type { QuestionWeightItem } from "@/types";

interface QuestionWeightRowProps {
  question: QuestionWeightItem;
  onSaved: (questionId: number, weight: number) => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

// Dragging a slider fires continuously; only persist once it settles.
const SAVE_DEBOUNCE_MS = 400;
const SAVED_NOTICE_MS = 2000;

function weightLabel(weight: number): string {
  if (weight === 0) return "Never drawn";
  if (weight === 100) return "Always drawn";
  if (weight === 50) return "Default";
  return `${weight}`;
}

export default function QuestionWeightRow({ question, onSaved }: QuestionWeightRowProps) {
  const [weight, setWeight] = useState(question.weight);
  // Kept as text so clearing the box doesn't read as 0 — which would be a
  // permanent exclusion, not an empty field.
  const [draft, setDraft] = useState(String(question.weight));
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState("");

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<number | null>(null);
  const savedWeight = useRef(question.weight);
  const mounted = useRef(true);
  // Saves for one question run one after another: concurrent PATCHes could
  // otherwise land out of order and leave the stored weight behind the UI.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const requestSeq = useRef(0);

  const save = (next: number) => {
    pending.current = null;
    const seq = ++requestSeq.current;

    chain.current = chain.current
      .then(async () => {
        // A newer edit was made while this one waited its turn — skip it, the
        // newer value is already queued behind us.
        if (seq !== requestSeq.current) return;
        if (next === savedWeight.current) {
          if (mounted.current) {
            setState("idle");
            setError("");
          }
          return;
        }
        if (mounted.current) {
          setState("saving");
          setError("");
        }

        try {
          const res = await api.updateQuestionWeight(question.id, next);
          savedWeight.current = res.weight;
          onSaved(question.id, res.weight);
          if (!mounted.current || seq !== requestSeq.current) return;
          setState("saved");
          if (noticeTimer.current) clearTimeout(noticeTimer.current);
          noticeTimer.current = setTimeout(() => setState("idle"), SAVED_NOTICE_MS);
        } catch (err: unknown) {
          if (!mounted.current || seq !== requestSeq.current) return;
          setState("error");
          setError(err instanceof Error ? err.message : "Failed to save");
        }
      })
      .catch(() => {});

    return chain.current;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      if (timer.current) clearTimeout(timer.current);
      // Flush an edit still waiting out its debounce, so paging away or
      // leaving the screen cannot silently drop it. It joins the same chain,
      // so it cannot overtake a request already in flight.
      if (pending.current !== null) void save(pending.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const scheduleSave = (next: number) => {
    setWeight(next);
    setDraft(String(next));
    pending.current = next;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(next), SAVE_DEBOUNCE_MS);
  };

  const isExcluded = weight === 0;
  const isAlways = weight === 100;

  return (
    <li className="py-3 border-b border-gray-100 last:border-b-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-medium text-gray-700">
              {question.external_id}
            </span>
            {question.domain_name && <Badge>{question.domain_name}</Badge>}
            {isExcluded && <Badge color="red">Never drawn</Badge>}
            {isAlways && <Badge color="green">Always drawn</Badge>}
          </div>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{question.question_preview}</p>
        </div>

        <div className="w-56 shrink-0">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={weight}
              aria-label={`Draw weight for ${question.external_id}`}
              onChange={(e) => scheduleSave(Number(e.target.value))}
              className="w-full accent-accent-600 cursor-pointer"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={draft}
              aria-label={`Draw weight value for ${question.external_id}`}
              onChange={(e) => {
                const raw = e.target.value;
                setDraft(raw);
                if (raw === "") return; // wait for a real value
                const parsed = Number(raw);
                if (!Number.isFinite(parsed)) return;
                scheduleSave(Math.min(100, Math.max(0, Math.round(parsed))));
              }}
              onBlur={() => setDraft(String(weight))}
              className="w-16 shrink-0 px-2 py-1 border border-gray-200 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>
          <p className="mt-1 text-xs text-right">
            {state === "saving" && <span className="text-gray-400">Saving…</span>}
            {state === "saved" && <span className="text-green-600">Saved</span>}
            {state === "error" && <span className="text-red-600">{error}</span>}
            {state === "idle" && <span className="text-gray-400">{weightLabel(weight)}</span>}
          </p>
        </div>
      </div>
    </li>
  );
}
