"use client";

export default function LatencyGraph({ data }) {
  // Ponytail: Minimal SVG sparkline graph. Zero dependencies.
  
  const width = 600;
  const height = 100;
  const maxPoints = 50;
  
  // Keep only the last N points
  const points = data.slice(-maxPoints);
  
  // Scale logic
  const maxLatency = Math.max(10, ...points.map(p => p.latency));
  
  const xStep = width / (maxPoints - 1);
  
  const pathData = points.map((p, i) => {
    const x = i * xStep;
    // Invert Y axis for SVG (0 is top)
    const y = height - ((p.latency / maxLatency) * height * 0.8); // 80% to leave top padding
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const currentLatency = points.length > 0 ? points[points.length - 1].latency : 0;

  // Calculate metrics over all data
  const allLatencies = data.map(d => d.latency).sort((a, b) => a - b);
  let mean = 0, p25 = 0, p75 = 0, p90 = 0;
  if (allLatencies.length > 0) {
    mean = (allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(1);
    const getP = (p) => allLatencies[Math.floor(allLatencies.length * p)].toFixed(1);
    p25 = getP(0.25);
    p75 = getP(0.75);
    p90 = getP(0.90);
  }

  return (
    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Round Trip Time (RTT)</h3>
        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
          {currentLatency} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ms</span>
        </span>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <path
          d={pathData}
          fill="none"
          stroke="var(--accent-violet)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <line x1="0" y1={height} x2={width} y2={height} stroke="var(--border-subtle)" strokeWidth="1" />
      </svg>
      
      {allLatencies.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          <div>Mean: <span style={{ color: 'white' }}>{mean} ms</span></div>
          <div>p25: <span style={{ color: 'white' }}>{p25} ms</span></div>
          <div>p75: <span style={{ color: 'white' }}>{p75} ms</span></div>
          <div>p90: <span style={{ color: 'white' }}>{p90} ms</span></div>
        </div>
      )}
    </div>
  );
}
