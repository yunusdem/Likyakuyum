import React, { useState, useEffect } from "react";

interface LiveClockProps {
  mode?: "time" | "date" | "datetime";
}

const formatNow = (mode: "time" | "date" | "datetime"): string => {
  const now = new Date();
  if (mode === "date") {
    return now.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  if (mode === "datetime") {
    return (
      now.toLocaleDateString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) +
      " " +
      now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }
  return now.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const LiveClock: React.FC<LiveClockProps> = React.memo(({ mode = "time" }) => {
  const [text, setText] = useState<string>(() => formatNow(mode));

  useEffect(() => {
    const intervalMs = mode === "date" ? 60_000 : 1000;
    const timer = window.setInterval(() => {
      const next = formatNow(mode);
      setText((prev) => (prev === next ? prev : next));
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [mode]);

  return <>{text}</>;
});

LiveClock.displayName = "LiveClock";

export default LiveClock;
