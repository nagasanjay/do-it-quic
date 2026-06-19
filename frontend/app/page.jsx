"use client";

import { useState, useCallback, useEffect } from "react";
import NetworkSlider from "./components/NetworkSlider";
import StatusIndicator from "./components/StatusIndicator";
import ApplyButton from "./components/ApplyButton";
import PacketFlowViz from "./components/PacketFlowViz";
import { updateNetwork, getNetworkConfig } from "./lib/api";

const MAX_PACKET_LOSS = 30;
const MAX_LATENCY = 300;

export default function Home() {
  const [packetLoss, setPacketLoss] = useState(0);
  const [latency, setLatency] = useState(0);

  // Fetch current config from backend on mount
  useEffect(() => {
    getNetworkConfig()
      .then((config) => {
        setPacketLoss(config.packet_loss);
        setLatency(config.latency);
      })
      .catch(() => {
        // Backend might not be running — keep defaults
      });
  }, []);

  const handleApply = useCallback(async () => {
    await updateNetwork(packetLoss, latency);
  }, [packetLoss, latency]);

  const handleReset = useCallback(() => {
    setPacketLoss(0);
    setLatency(0);
    // Also push the reset to the backend
    updateNetwork(0, 0).catch(() => {
      // Silent fail on reset — network is best-effort
    });
  }, []);

  return (
    <main className="app-container">
      {/* Header */}
      <header className="app-header">
        <span className="app-header__icon">🌐</span>
        <h1 className="app-header__title">Do-It-QUIC</h1>
        <p className="app-header__subtitle">Network Impairment Controller</p>
      </header>

      {/* Status */}
      <StatusIndicator packetLoss={packetLoss} latency={latency} />

      {/* Sliders */}
      <div className="controls-grid">
        <NetworkSlider
          id="slider-packet-loss"
          label="Packet Loss"
          value={packetLoss}
          onChange={setPacketLoss}
          min={0}
          max={MAX_PACKET_LOSS}
          step={1}
          unit="%"
          icon="📡"
          variant="cyan"
        />
        <NetworkSlider
          id="slider-latency"
          label="Latency"
          value={latency}
          onChange={setLatency}
          min={0}
          max={MAX_LATENCY}
          step={10}
          unit="ms"
          icon="⏱️"
          variant="violet"
        />
      </div>

      {/* Packet Flow Visualization */}
      <PacketFlowViz packetLoss={packetLoss} latency={latency} />

      {/* Actions */}
      <ApplyButton
        onApply={handleApply}
        onReset={handleReset}
        disabled={false}
      />

      {/* Footer */}
      <footer className="app-footer">
        <p className="app-footer__text">
          QUIC Network Impairment Testing Tool
        </p>
      </footer>
    </main>
  );
}
