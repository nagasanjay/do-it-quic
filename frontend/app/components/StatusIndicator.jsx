"use client";

import { useMemo } from "react";

/**
 * StatusIndicator — shows network health as Optimal / Degraded / Impaired
 * with an animated pulsing dot.
 *
 * Props:
 *   packetLoss — current packet loss value (0-30)
 *   latency    — current latency value (0-300)
 */
export default function StatusIndicator({ packetLoss, latency }) {
  const status = useMemo(() => {
    if (packetLoss === 0 && latency === 0) {
      return { level: "optimal", text: "Network Optimal" };
    }

    const lossRatio = packetLoss / 30;
    const latencyRatio = latency / 300;
    const combined = (lossRatio + latencyRatio) / 2;

    if (combined < 0.35) {
      return { level: "degraded", text: "Network Degraded" };
    }
    return { level: "impaired", text: "Network Impaired" };
  }, [packetLoss, latency]);

  return (
    <div
      className={`status-bar status-bar--${status.level}`}
      id="status-indicator"
      role="status"
      aria-live="polite"
    >
      <span className="status-bar__dot" />
      <span>{status.text}</span>
    </div>
  );
}
