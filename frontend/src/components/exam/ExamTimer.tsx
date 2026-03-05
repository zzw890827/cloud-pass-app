"use client";

import { useState, useEffect } from "react";

interface ExamTimerProps {
  startedAt: string;
  timeLimitMinutes: number;
  onTimeUp?: () => void;
}

export default function ExamTimer({ startedAt, timeLimitMinutes, onTimeUp }: ExamTimerProps) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    const endTime = new Date(startedAt).getTime() + timeLimitMinutes * 60 * 1000;

    const update = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((endTime - now) / 1000));
      setRemaining(diff);
      if (diff === 0) {
        onTimeUp?.();
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt, timeLimitMinutes, onTimeUp]);

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const isLow = remaining < 300; // < 5 minutes

  const formatted = hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <span className={`font-mono text-sm font-medium ${isLow ? "text-red-600" : "text-gray-700"}`}>
      {formatted}
    </span>
  );
}
