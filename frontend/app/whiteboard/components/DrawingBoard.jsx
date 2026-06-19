"use client";

import { useRef, useImperativeHandle, forwardRef, useEffect } from "react";

const DrawingBoard = forwardRef(({ onDraw }, ref) => {
  const leftCanvasRef = useRef(null);
  const rightCanvasRef = useRef(null);
  
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Expose a method to the parent to draw received points
  useImperativeHandle(ref, () => ({
    drawReceived: (data) => {
      const canvas = rightCanvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      
      if (data.type === "start") {
        ctx.beginPath();
        ctx.moveTo(data.x, data.y);
      } else if (data.type === "draw") {
        ctx.lineTo(data.x, data.y);
        ctx.strokeStyle = "#a78bfa"; // Violet accent
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.stroke();
      } else if (data.type === "end") {
        ctx.closePath();
      } else if (data.type === "clear") {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    },
    clearLocal: () => {
      const canvas = leftCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }));

  const getCoordinates = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    isDrawing.current = true;
    const canvas = leftCanvasRef.current;
    const coords = getCoordinates(e, canvas);
    lastPos.current = coords;

    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);

    onDraw({ ...coords, type: "start", ts: performance.now() });
  };

  const handlePointerMove = (e) => {
    if (!isDrawing.current) return;
    const canvas = leftCanvasRef.current;
    const coords = getCoordinates(e, canvas);
    
    const ctx = canvas.getContext("2d");
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = "#2dd4bf"; // Cyan accent
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();

    onDraw({ ...coords, type: "draw", ts: performance.now() });
  };

  const handlePointerUp = (e) => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const canvas = leftCanvasRef.current;
    const coords = getCoordinates(e, canvas);

    const ctx = canvas.getContext("2d");
    ctx.closePath();

    onDraw({ ...coords, type: "end", ts: performance.now() });
  };

  // Ensure canvases have proper internal resolution
  useEffect(() => {
    [leftCanvasRef.current, rightCanvasRef.current].forEach(canvas => {
      if (canvas) {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
    });
  }, []);

  return (
    <div style={{ display: 'flex', gap: '20px', height: '400px', width: '100%' }}>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: '#888', pointerEvents: 'none' }}>Local (Draw Here)</div>
        <canvas
          ref={leftCanvasRef}
          style={{ width: '100%', height: '100%', background: '#1e293b', borderRadius: '12px', touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerOut={handlePointerUp}
        />
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 10, left: 10, fontSize: '12px', color: '#888', pointerEvents: 'none' }}>Server Response</div>
        <canvas
          ref={rightCanvasRef}
          style={{ width: '100%', height: '100%', background: '#1e293b', borderRadius: '12px', pointerEvents: 'none' }}
        />
      </div>
    </div>
  );
});

DrawingBoard.displayName = "DrawingBoard";

export default DrawingBoard;
