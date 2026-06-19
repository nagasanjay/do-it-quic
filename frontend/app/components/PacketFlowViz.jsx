"use client";

import { useMemo } from "react";

/**
 * PacketFlowViz — a cosmetic animation showing dots moving across a track.
 * Dots that are "dropped" animate downward and fade out.
 * Speed is proportional to latency, drop ratio to packet loss.
 *
 * Props:
 *   packetLoss — 0-30 (percentage of dots that drop)
 *   latency    — 0-300 (controls speed: higher = slower)
 */
export default function PacketFlowViz({ packetLoss, latency }) {
  const dots = useMemo(() => {
    const totalDots = 12;
    const dropCount = Math.round((packetLoss / 30) * totalDots);
    // Base speed 2s, up to 6s at max latency
    const speed = 2 + (latency / 300) * 4;

    return Array.from({ length: totalDots }, (_, i) => {
      const isDropped = i < dropCount;
      const delay = Math.round(((i / totalDots) * speed) * 100) / 100;
      const yOffset = Math.round((15 + Math.sin(i * 1.8) * 12) * 100) / 100;

      return {
        key: i,
        isDropped,
        style: {
          "--packet-speed": `${speed}s`,
          "--packet-opacity": isDropped ? "0.4" : "1",
          animationDelay: `${delay}s`,
          top: `${yOffset}px`,
        },
      };
    });
  }, [packetLoss, latency]);

  return (
    <div className="packet-viz" id="packet-viz">
      <span className="packet-viz__label">Packet Flow Simulation</span>
      <div className="packet-viz__track">
        {dots.map((dot) => (
          <span
            key={dot.key}
            className={`packet-dot ${dot.isDropped ? "packet-dot--dropped" : ""}`}
            style={dot.style}
          />
        ))}
      </div>
    </div>
  );
}
