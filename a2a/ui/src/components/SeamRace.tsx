import { useEffect, useState } from "react";
import "./SeamRace.css";

interface SeamProps {
  lastSeam: { taskId: string; at: number } | null;
}

// The center seam (1D.3 / T8). A gold pulse travels left→right when the ring rail
// fires — "the microsecond intercept made visible". The ring-vs-rpc latency numbers
// now live on the timeline's INTERCEPT row; the seam keeps just the pulse.
export function SeamRace({ lastSeam }: SeamProps) {
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (lastSeam) setPulseKey((k) => k + 1);
  }, [lastSeam?.at]);

  return (
    <div className="seam" aria-hidden>
      <div className="seam-line" />
      {pulseKey > 0 && <div className="seam-pulse" key={pulseKey} />}
    </div>
  );
}
