package network

import (
	"context"
	"io"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
	"github.com/quic-go/webtransport-go"
)

// echoPayload represents a drawing coordinate from the frontend
type echoPayload struct {
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	Type string  `json:"type"`
	TS   int64   `json:"ts"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true }, // Ponytail: Accept all for local dev
}

// HandleWebSocketEcho handles WebSocket connections for the whiteboard
func HandleWebSocketEcho() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("WS Upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		for {
			messageType, message, err := conn.ReadMessage()
			if err != nil {
				break
			}
			// Immediately echo back
			if err := conn.WriteMessage(messageType, message); err != nil {
				break
			}
		}
	}
}

// HandleWebTransportEcho handles WebTransport connections
func HandleWebTransportEcho(wtServer *webtransport.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, err := wtServer.Upgrade(w, r)
		if err != nil {
			log.Printf("WebTransport upgrade failed: %v", err)
			return
		}

		// Handle Bidirectional Streams
		go func() {
			for {
				ctx := context.Background()
				stream, err := session.AcceptStream(ctx)
				if err != nil {
					return
				}

				// Echo per-stream
				go func(str io.ReadWriteCloser) {
					defer str.Close()
					buf := make([]byte, 1024)
					for {
						n, err := str.Read(buf)
						if err != nil {
							return
						}
						str.Write(buf[:n])
					}
				}(stream)
			}
		}()

		// Handle Unreliable Datagrams
		go func() {
			for {
				ctx := context.Background()
				msg, err := session.ReceiveDatagram(ctx)
				if err != nil {
					return
				}
				// Echo datagram immediately
				session.SendDatagram(msg)
			}
		}()
	}
}

