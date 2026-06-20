"use client";

import { useState, useEffect, useRef } from "react";
import AudioPanel from "./components/AudioPanel";
import { AudioReceiver } from "./lib/audioReceiver";

export default function RadioPage() {
  const [tcpStatus, setTcpStatus] = useState("disconnected");
  const [tcpMetrics, setTcpMetrics] = useState({ packets: 0, latency: 0, bufferSize: 0, reconnects: 0 });
  const [tcpWaveform, setTcpWaveform] = useState([]);
  const [tcpPlaying, setTcpPlaying] = useState(false);
  const [tcpMuted, setTcpMuted] = useState(false);

  const [quicStatus, setQuicStatus] = useState("disconnected");
  const [quicMetrics, setQuicMetrics] = useState({ packets: 0, latency: 0, bufferSize: 0 });
  const [quicWaveform, setQuicWaveform] = useState([]);
  const [quicPlaying, setQuicPlaying] = useState(false);
  const [quicMuted, setQuicMuted] = useState(false);

  const tcpReceiverRef = useRef(null);
  const quicReceiverRef = useRef(null);

  // Initialize receivers
  useEffect(() => {
    tcpReceiverRef.current = new AudioReceiver(
      "websocket",
      (metrics) => {
        if (metrics.status) setTcpStatus(metrics.status);
        setTcpMetrics((prev) => ({ ...prev, ...metrics }));
      },
      (data) => setTcpWaveform(data)
    );

    quicReceiverRef.current = new AudioReceiver(
      "webtransport",
      (metrics) => {
        if (metrics.status) setQuicStatus(metrics.status);
        setQuicMetrics((prev) => ({ ...prev, ...metrics }));
      },
      (data) => setQuicWaveform(data)
    );

    return () => {
      if (tcpReceiverRef.current) tcpReceiverRef.current.stop();
      if (quicReceiverRef.current) quicReceiverRef.current.stop();
    };
  }, []);

  const handleTcpPlayToggle = () => {
    if (tcpPlaying) {
      tcpReceiverRef.current.stop();
      setTcpPlaying(false);
      setTcpStatus("disconnected");
    } else {
      tcpReceiverRef.current.start();
      setTcpPlaying(true);
    }
  };

  const handleQuicPlayToggle = () => {
    if (quicPlaying) {
      quicReceiverRef.current.stop();
      setQuicPlaying(false);
      setQuicStatus("disconnected");
    } else {
      quicReceiverRef.current.start();
      setQuicPlaying(true);
    }
  };

  const handleTcpMuteToggle = () => {
    const nextMuted = !tcpMuted;
    setTcpMuted(nextMuted);
    if (tcpReceiverRef.current) {
      tcpReceiverRef.current.setMute(nextMuted);
    }
  };

  const handleQuicMuteToggle = () => {
    const nextMuted = !quicMuted;
    setQuicMuted(nextMuted);
    if (quicReceiverRef.current) {
      quicReceiverRef.current.setMute(nextMuted);
    }
  };

  return (
    <main className="app-container radio-container">
      <header className="app-header">
        <span className="app-header__icon">📻</span>
        <h1 className="app-header__title">Resilient Radio</h1>
        <p className="app-header__subtitle">
          Comparing TCP (WebSocket) vs. QUIC (WebTransport) Audio Resilience
        </p>
      </header>

      {/* Showcase Tooltip Card */}
      <section className="glass-card showcase-card">
        <h3 className="showcase-card__title">💡 How to test Connection Migration</h3>
        <p className="showcase-card__text">
          1. Press <strong>Play</strong> on both streams. You will hear an arpeggiated C-Major synth melody.
          <br />
          2. While the audio is running, <strong>disconnect your VPN</strong> or <strong>switch Wi-Fi networks</strong>.
          <br />
          3. Watch the waveforms: The <strong>TCP WebSocket stream will freeze and fail</strong> (and attempt to reconnect).
          The <strong>QUIC WebTransport stream will seamlessly migrate path</strong> and keep playing after a brief sub-second hiccup.
        </p>
      </section>

      {/* Panels Layout */}
      <div className="radio-panels">
        <AudioPanel
          title="TCP Stream (WebSocket)"
          protocol="websocket"
          status={tcpStatus}
          metrics={tcpMetrics}
          waveform={tcpWaveform}
          isPlaying={tcpPlaying}
          isMuted={tcpMuted}
          onPlayToggle={handleTcpPlayToggle}
          onMuteToggle={handleTcpMuteToggle}
        />

        <AudioPanel
          title="QUIC Stream (WebTransport)"
          protocol="webtransport"
          status={quicStatus}
          metrics={quicMetrics}
          waveform={quicWaveform}
          isPlaying={quicPlaying}
          isMuted={quicMuted}
          onPlayToggle={handleQuicPlayToggle}
          onMuteToggle={handleQuicMuteToggle}
        />
      </div>

      <footer className="app-footer">
        <p className="app-footer__text">
          QUIC Connection Migration Demo • Powered by quic-go & WebTransport
        </p>
      </footer>
    </main>
  );
}
