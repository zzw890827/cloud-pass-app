"use client";

import { useEffect, useLayoutEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api-client";

// examId → provider slug. An exam's provider never changes within a session, so
// this keeps navigation inside an exam from re-fetching — and, more visibly,
// lets a known theme be applied before the browser paints.
const slugCache = new Map<number, string>();

// useLayoutEffect warns when it runs during server rendering, where it is a no-op.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

function applyTheme(slug: string) {
  document.documentElement.dataset.provider = slug;
}

/**
 * Paints the app in the provider's colours while one of their exams is open, by
 * putting `data-provider` on the document element — globals.css overrides the
 * accent variables from there, so no component needs to know which provider it
 * renders for, and the navbar is themed along with the page. A provider with no
 * palette of its own simply matches no rule and keeps the default one.
 *
 * Renders nothing; it exists so the exam layout can stay a server component.
 */
export default function ProviderTheme() {
  const params = useParams();
  const examId = Number(params.examId);
  const isValidId = Number.isInteger(examId) && examId > 0;

  // A cached slug is applied before the first paint, so arriving from elsewhere
  // in the app does not flash the default palette for a frame.
  useBeforePaint(() => {
    const cached = slugCache.get(examId);
    if (cached) applyTheme(cached);
    // Deliberately no cleanup: while switching between exams, keeping the
    // previous palette until the new one resolves beats flashing back to the
    // default. Leaving the exam section entirely is handled below.
  }, [examId]);

  useEffect(() => {
    if (!isValidId || slugCache.has(examId)) return;
    let cancelled = false;

    api.getExam(examId)
      .then((exam) => {
        if (!exam.provider_slug) return;
        slugCache.set(examId, exam.provider_slug);
        if (!cancelled) applyTheme(exam.provider_slug);
      })
      .catch((err) => {
        console.error("Failed to resolve the exam's provider theme", err);
      });

    return () => {
      cancelled = true;
    };
  }, [examId, isValidId]);

  // Unmount means the exam section itself was left — back to the default theme.
  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.provider;
    };
  }, []);

  return null;
}
