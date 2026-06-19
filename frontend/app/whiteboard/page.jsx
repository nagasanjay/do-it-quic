"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import DrawingBoard from "./components/DrawingBoard";
import LatencyGraph from "./components/LatencyGraph";
import { ProtocolConnection } from "./lib/protocols";

export default function WhiteboardPage() {
  const [protocol, setProtocol] = useState("websocket");
  const [status, setStatus] = useState("disconnected"); // disconnected, connecting, connected
  const [latencies, setLatencies] = useState([]);
  
  const connectionRef = useRef(null);
  const drawingBoardRef = useRef(null);

  // Initialize Connection
  const connect = useCallback(async (selectedProtocol) => {
    if (connectionRef.current) {
      connectionRef.current.close();
    }
    
    setStatus("connecting");
    setLatencies([]);
    if (drawingBoardRef.current) {
      drawingBoardRef.current.clearLocal();
    }

    try {
      const conn = new ProtocolConnection(selectedProtocol, (data) => {
        // Handle incoming message
        if (drawingBoardRef.current) {
          drawingBoardRef.current.drawReceived(data);
        }
        
        // Calculate Latency if we have a timestamp
        if (data.ts) {
          const rtt = parseFloat((performance.now() - data.ts).toFixed(2));
          setLatencies((prev) => [...prev, { time: performance.now(), latency: rtt }]);
        }
      });
      
      await conn.connect();
      connectionRef.current = conn;
      setStatus("connected");
    } catch (err) {
      setStatus("disconnected");
      console.error(err);
      alert("Failed to connect via " + selectedProtocol);
    }
  }, []);

  // Connect on mount and when protocol changes
  useEffect(() => {
    connect(protocol);
    return () => {
      if (connectionRef.current) {
        connectionRef.current.close();
      }
    };
  }, [protocol, connect]);

  const handleDraw = useCallback((data) => {
    if (connectionRef.current && status === "connected") {
      connectionRef.current.send(data);
    }
  }, [status]);

  const handleClear = useCallback(() => {
    if (drawingBoardRef.current) {
      drawingBoardRef.current.clearLocal();
    }
    handleDraw({ type: "clear" });
    setLatencies([]); // Optionally clear the latency graph too
  }, [handleDraw]);

  return (
    <main className="app-container" style={{ maxWidth: '900px' }}>
      <header className="app-header" style={{ padding: '2rem 0 1rem' }}>
        <h1 className="app-header__title">Protocol Whiteboard</h1>
        <p className="app-header__subtitle">Real-time Echo using WebSocket vs WebTransport</p>
      </header>

      <div className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ fontWeight: '600' }}>Protocol:</label>
        <select 
          value={protocol} 
          onChange={(e) => setProtocol(e.target.value)}
          style={{
            background: 'var(--bg-base)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            flex: 1
          }}
        >
          <option value="websocket">WebSocket (TCP Reliable)</option>
          <option value="webtransport-reliable">WebTransport (QUIC Reliable Streams)</option>
          <option value="webtransport-unreliable">WebTransport (QUIC Unreliable Datagrams)</option>
        </select>
        
        <button 
          onClick={handleClear}
          style={{
            background: 'var(--accent-primary)',
            color: 'white',
            border: 'none',
            padding: '0.5rem 1rem',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          Clear Canvas
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%',
            background: status === 'connected' ? 'var(--severity-optimal)' : 
                        status === 'connecting' ? 'var(--severity-degraded)' : 'var(--severity-impaired)'
          }} />
          <span style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>{status}</span>
        </div>
      </div>

      <LatencyGraph data={latencies} />

      <div className="glass-card" style={{ padding: '10px' }}>
        <DrawingBoard ref={drawingBoardRef} onDraw={handleDraw} />
      </div>
    </main>
  );
}
