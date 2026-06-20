"use client";

import { useEffect, useRef } from "react";

export default function AudioPanel({
  title,
  protocol,
  status,
  metrics,
  waveform,
  isPlaying,
  isMuted,
  onPlayToggle,
  onMuteToggle,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Sleek, semi-transparent background
    ctx.fillStyle = "rgba(10, 10, 18, 0.4)";
    ctx.fillRect(0, 0, width, height);

    // Draw baseline
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = protocol === "websocket" ? "rgba(34, 211, 238, 0.2)" : "rgba(167, 139, 250, 0.2)";
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    if (!isPlaying || !waveform || waveform.length === 0 || status === "disconnected" || status === "connecting") {
      return;
    }

    // Draw waveform with glow effect
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = protocol === "websocket" ? "var(--accent-cyan)" : "var(--accent-violet)";
    ctx.shadowBlur = 8;
    ctx.shadowColor = protocol === "websocket" ? "var(--accent-cyan)" : "var(--accent-violet)";
    
    ctx.beginPath();
    const sliceWidth = width / waveform.length;
    let x = 0;

    for (let i = 0; i < waveform.length; i++) {
      const v = waveform[i]; // range [-1.0, 1.0]
      const y = (v + 1) * (height / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0; // reset glow
  }, [waveform, isPlaying, protocol, status]);

  // Determine status color class
  const getStatusClass = () => {
    switch (status) {
      case "connected":
        return "status-badge--connected";
      case "connecting":
        return "status-badge--connecting";
      case "disconnected":
        return "status-badge--disconnected";
      default:
        return "status-badge--idle";
    }
  };

  return (
    <div className={`glass-card audio-panel audio-panel--${protocol}`}>
      <div className="audio-panel__header">
        <h2 className="audio-panel__title">
          <span className="audio-panel__icon">{protocol === "websocket" ? "🔌" : "⚡"}</span>
          {title}
        </h2>
        <span className={`status-badge ${getStatusClass()}`}>
          <span className="status-badge__dot"></span>
          {status ? status.toUpperCase() : "OFFLINE"}
        </span>
      </div>

      <div className="audio-panel__waveform-container">
        <canvas
          ref={canvasRef}
          className="audio-panel__canvas"
          width={600}
          height={120}
        />
      </div>

      <div className="audio-panel__controls">
        <button
          onClick={onPlayToggle}
          className={`btn ${isPlaying ? "btn--secondary" : "btn--primary"}`}
        >
          {isPlaying ? "⏹️ Stop Stream" : "▶️ Play Stream"}
        </button>
        <button
          onClick={onMuteToggle}
          disabled={!isPlaying}
          className="btn btn--secondary"
        >
          {isMuted ? "🔊 Unmute" : "🔇 Mute"}
        </button>
      </div>

      <div className="audio-panel__metrics">
        <div className="metric-box">
          <span className="metric-label">Packets Received</span>
          <span className="metric-value">{metrics.packets || 0}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Audio Buffer Delay</span>
          <span className="metric-value">{metrics.bufferSize ? `${metrics.bufferSize}s` : "0.00s"}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Playback Latency</span>
          <span className="metric-value">{metrics.latency ? `${metrics.latency}ms` : "0ms"}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Resilience Metric</span>
          <span className="metric-value metric-value--highlight">
            {protocol === "websocket"
              ? `${metrics.reconnects || 0} dropouts`
              : "Active Migration"}
          </span>
        </div>
      </div>
    </div>
  );
}
