export class ProtocolConnection {
  constructor(protocol, onMessage) {
    this.protocol = protocol;
    this.onMessage = onMessage;
    this.ws = null;
    this.wt = null;
    this.wtStream = null;
    this.wtWriter = null;
  }

  async connect() {
    const wsUrl = (process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080").replace(/\/?$/, "/ws");
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const apiUrl = `${apiBase}/api/cert`;
    const wtUrl = (process.env.NEXT_PUBLIC_WT_URL || "https://localhost:8081").replace(/\/?$/, "/wt");

    if (this.protocol === "websocket") {
      this.ws = new WebSocket(wsUrl);
      this.ws.onmessage = (event) => {
        this.onMessage(JSON.parse(event.data));
      };
      return new Promise((resolve, reject) => {
        this.ws.onopen = resolve;
        this.ws.onerror = reject;
      });
    } else if (this.protocol === "webtransport-reliable" || this.protocol === "webtransport-unreliable") {
      try {
        const res = await fetch(apiUrl);
        const { hash } = await res.json();

        // Convert base64 hash to Uint8Array
        const binaryString = atob(hash);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        this.wt = new WebTransport(wtUrl, {
          serverCertificateHashes: [{ algorithm: "sha-256", value: bytes }],
        });

        await this.wt.ready;

        if (this.protocol === "webtransport-reliable") {
          this.wtStream = await this.wt.createBidirectionalStream();
          this.wtWriter = this.wtStream.writable.getWriter();
        } else {
          this.wtWriter = this.wt.datagrams.writable.getWriter();
        }

        this.startWebTransportReadLoop();
      } catch (err) {
        console.error("WebTransport connection failed:", err);
        throw err;
      }
    }
  }

  async startWebTransportReadLoop() {
    const reader = this.protocol === "webtransport-reliable"
      ? this.wtStream.readable.getReader()
      : this.wt.datagrams.readable.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        if (this.protocol === "webtransport-reliable") {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop();
          for (const part of parts) {
            if (part.trim()) this.onMessage(JSON.parse(part));
          }
        } else {
          // Datagrams arrive as whole packets, no buffering/splitting required!
          const text = decoder.decode(value);
          if (text.trim()) {
            this.onMessage(JSON.parse(text));
          }
        }
      }
    } catch (err) {
      if (!err.message?.includes("closed")) {
        console.error("WebTransport read error:", err);
      }
    } finally {
      reader.releaseLock();
    }
  }

  send(data) {
    const payload = JSON.stringify(data);
    if (this.protocol === "websocket" && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else if (this.protocol.startsWith("webtransport") && this.wtWriter) {
      const encoder = new TextEncoder();
      if (this.protocol === "webtransport-reliable") {
        this.wtWriter.write(encoder.encode(payload + "\n"));
      } else {
        // Datagrams don't need newline delimiters
        this.wtWriter.write(encoder.encode(payload));
      }
    }
  }

  close() {
    if (this.ws) this.ws.close();
    if (this.wtWriter) this.wtWriter.releaseLock();
    if (this.wt) this.wt.close();
  }
}
