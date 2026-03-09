"use client";

import { useState, useEffect } from "react";

interface ExamTimerProps {
  startedAt: string;
  timeLimitMinutes: number;
  elapsedSeconds: number;
  paused: boolean;
  onTimeUp?: () => void;
}

export default function ExamTimer({ startedAt, timeLimitMinutes, elapsedSeconds, paused, onTimeUp }: ExamTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const totalSeconds = timeLimitMinutes * 60;

    const update = () => {
      if (paused) {
        setRemaining(Math.max(0, totalSeconds - elapsedSeconds));
        return;
      }
      const utcStarted = startedAt.endsWith("Z") ? startedAt : startedAt + "Z";
      const startTime = new Date(utcStarted).getTime();
      const activeElapsed = Math.floor((Date.now() - startTime) / 1000);
      const diff = Math.max(0, totalSeconds - elapsedSeconds - activeElapsed);
      setRemaining(diff);
      if (diff === 0) {
        onTimeUp?.();
      }
    };

    update();
    if (paused) return;

    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, elapsedSeconds, paused, onTimeUp]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const isLow = remaining < 300; // < 5 minutes

  const formatted = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className={`font-mono text-sm font-medium ${isLow ? "text-red-600" : "text-gray-700"}`}>
      {paused ? `${formatted} (Paused)` : formatted}
    </span>
  );
}
