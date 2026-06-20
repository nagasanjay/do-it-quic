export class AudioReceiver {
  constructor(protocol, onMetrics, onWaveform) {
    this.protocol = protocol;
    this.onMetrics = onMetrics;
    this.onWaveform = onWaveform;
    this.audioCtx = null;
    this.analyser = null;
    this.gainNode = null;
    this.ws = null;
    this.wt = null;
    this.nextPlayTime = 0;
    this.packetCount = 0;
    this.isPlaying = false;
    this.isMuted = false;
    this.reconnectCount = 0;
    this.sampleRate = 16000;
    this.watchdog = null;
    this.watchdogTimeout = 2000; // 2 seconds silence threshold
  }

  async start() {
    this.isPlaying = true;
    this.packetCount = 0;

    // Initialize Audio Context
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.gain.value = this.isMuted ? 0 : 0.5; // Default 50% volume

      this.analyser.connect(this.gainNode);
      this.gainNode.connect(this.audioCtx.destination);
      
      this.nextPlayTime = this.audioCtx.currentTime;
    } catch (err) {
      console.error("Failed to initialize Web Audio API:", err);
      this.onMetrics({ status: "error", error: "Audio API Init Failed" });
      return;
    }

    // Start connection
    this.connect();
    
    // Start waveform analysis loop
    this.startWaveformLoop();
  }

  async connect() {
    if (!this.isPlaying) return;

    this.onMetrics({ status: "connecting" });

    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080").replace(/\/?$/, "/audio/ws");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const apiUrl = `${apiBase}/api/cert`;
    const wtUrl = (process.env.NEXT_PUBLIC_WT_URL || "https://localhost:8081").replace(/\/?$/, "/audio/wt");

    if (this.protocol === "websocket") {
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.binaryType = "arraybuffer";

        this.ws.onopen = () => {
          this.onMetrics({ status: "connected" });
        };

        this.ws.onmessage = (event) => {
          if (!this.isPlaying) return;
          this.packetCount++;
          this.handleAudioData(event.data);
        };

        this.ws.onclose = () => {
          if (this.isPlaying) {
            this.onMetrics({ status: "disconnected" });
            this.reconnectCount++;
            this.onMetrics({ reconnects: this.reconnectCount });
            // Attempt reconnect after 2 seconds
            setTimeout(() => this.connect(), 2000);
          }
        };

        this.ws.onerror = () => {
          this.onMetrics({ status: "error" });
        };
      } catch (err) {
        console.error("WebSocket setup failed:", err);
        this.onMetrics({ status: "error" });
      }
    } else if (this.protocol === "webtransport") {
      try {
        const res = await fetch(apiUrl);
        const { hash } = await res.json();

        const binaryString = atob(hash);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        this.wt = new WebTransport(wtUrl, {
          serverCertificateHashes: [{ algorithm: "sha-256", value: bytes }],
        });

        await this.wt.ready;
        this.onMetrics({ status: "connected" });

        // WebTransport audio is pushed down a single unidirectional stream opened by server
        const uniReader = this.wt.incomingUnidirectionalStreams.getReader();
        const { value: stream, done } = await uniReader.read();
        uniReader.releaseLock();

        if (done || !stream) {
          throw new Error("No incoming stream received");
        }

        const streamReader = stream.getReader();
        this.readWebTransportStream(streamReader);

      } catch (err) {
        console.error("WebTransport setup failed:", err);
        if (this.isPlaying) {
          this.onMetrics({ status: "disconnected" });
          // Attempt reconnect after 2 seconds
          setTimeout(() => this.connect(), 2000);
        }
      }
    }
  }

  async readWebTransportStream(reader) {
    try {
      while (this.isPlaying) {
        const { value, done } = await reader.read();
        if (done) break;
        this.packetCount++;
        this.handleAudioData(value);
      }
    } catch (err) {
      if (this.isPlaying) {
        console.error("WebTransport read stream error:", err);
      }
    } finally {
      reader.releaseLock();
      if (this.isPlaying) {
        this.onMetrics({ status: "disconnected" });
        setTimeout(() => this.connect(), 2000);
      }
    }
  }

  handleAudioData(data) {
    if (!this.audioCtx) return;

    // Convert binary PCM (16-bit mono) to Float32Array
    // To be 100% safe against alignment issues and buffer pooling offsets:
    // If it's a TypedArray (like Uint8Array from WebTransport), we copy its content to a new aligned buffer
    let buf = data;
    if (data.buffer) {
      const byteOffset = data.byteOffset;
      const byteLength = data.byteLength;
      buf = data.buffer.slice(byteOffset, byteOffset + byteLength);
    }

    const int16Samples = new Int16Array(buf);
    const float32Samples = new Float32Array(int16Samples.length);
    for (let i = 0; i < int16Samples.length; i++) {
      float32Samples[i] = int16Samples[i] / 32768.0;
    }

    // Try to auto-resume the context if it's suspended
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch((e) => console.error("Failed to resume AudioContext:", e));
    }

    const buffer = this.audioCtx.createBuffer(1, float32Samples.length, this.sampleRate);
    buffer.getChannelData(0).set(float32Samples);

    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);

    const currentTime = this.audioCtx.currentTime;
    if (this.nextPlayTime < currentTime) {
      // Add small safety buffer to prevent clicking/underrun on start
      this.nextPlayTime = currentTime + 0.05;
    }

    source.start(this.nextPlayTime);

    const latencyMs = (this.nextPlayTime - currentTime) * 1000;
    const bufferSize = this.nextPlayTime - currentTime;

    this.onMetrics({
      packets: this.packetCount,
      latency: Math.max(0, Math.round(latencyMs)),
      bufferSize: Math.max(0, parseFloat(bufferSize.toFixed(2))),
    });

    this.nextPlayTime += buffer.duration;
    this.resetWatchdog();
  }

  startWaveformLoop() {
    const draw = () => {
      if (!this.isPlaying || !this.analyser) return;

      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteTimeDomainData(dataArray);

      // Map [0, 255] to [-1.0, 1.0]
      const normalizedData = Array.from(dataArray).map(val => (val - 128) / 128);
      this.onWaveform(normalizedData);

      requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }

  setMute(isMuted) {
    this.isMuted = isMuted;
    if (this.gainNode) {
      this.gainNode.gain.value = isMuted ? 0 : 0.5;
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.wt) {
      this.wt.close();
      this.wt = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    if (this.watchdog) {
      clearTimeout(this.watchdog);
      this.watchdog = null;
    }
    this.analyser = null;
    this.gainNode = null;
    this.onMetrics({ status: "stopped", packets: 0, latency: 0, bufferSize: 0 });
  }

  resetWatchdog() {
    if (this.watchdog) clearTimeout(this.watchdog);
    if (!this.isPlaying) return;

    this.watchdog = setTimeout(() => {
      console.warn(`[${this.protocol}] Silence detected for ${this.watchdogTimeout}ms. Reconnecting...`);
      this.reconnect();
    }, this.watchdogTimeout);
  }

  reconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    if (this.wt) {
      try { this.wt.close(); } catch (e) {}
      this.wt = null;
    }
    
    this.onMetrics({ status: "disconnected" });
    this.reconnectCount++;
    this.onMetrics({ reconnects: this.reconnectCount });
    
    // Trigger reconnection
    this.connect();
  }
}
