package network

import (
	"log"
	"net/http"

	"do-it-quic-backend/internal/audio"
	"github.com/gorilla/websocket"
	"github.com/quic-go/webtransport-go"
)

var audioUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// HandleAudioWebSocket upgrades connection to WebSocket and streams raw PCM audio
func HandleAudioWebSocket(b *audio.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("[WS] Upgrading audio connection...")
		conn, err := audioUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[WS] Audio WS upgrade failed: %v", err)
			return
		}
		defer conn.Close()
		log.Println("[WS] Audio WS upgraded successfully. Registering listener...")

		ch := b.Register()
		defer b.Unregister(ch)

		log.Println("[WS] Listener registered. Starting packet stream...")
		var sentPackets int
		for chunk := range ch {
			if err := conn.WriteMessage(websocket.BinaryMessage, chunk); err != nil {
				log.Printf("[WS] Connection closed: %v", err)
				break
			}
			sentPackets++
			if sentPackets%100 == 0 {
				log.Printf("[WS] Sent 100 packets (Total: %d)", sentPackets)
			}
		}
	}
}

// HandleAudioWebTransport upgrades connection to WebTransport, opens a unidirectional stream, and streams raw PCM
func HandleAudioWebTransport(wtServer *webtransport.Server, b *audio.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println("[WT] Upgrading audio connection...")
		session, err := wtServer.Upgrade(w, r)
		if err != nil {
			log.Printf("[WT] Audio WebTransport upgrade failed: %v", err)
			return
		}
		log.Println("[WT] Upgraded successfully. Opening unidirectional stream...")

		ctx := r.Context()

		// ponytail: Open a single reliable unidirectional stream to push audio packets down
		stream, err := session.OpenUniStream()
		if err != nil {
			log.Printf("[WT] Failed to open unidirectional stream: %v", err)
			session.CloseWithError(0, "failed to open stream")
			return
		}
		defer stream.Close()
		log.Println("[WT] Unidirectional stream opened. Registering listener...")

		ch := b.Register()
		defer b.Unregister(ch)

		log.Println("[WT] Listener registered. Starting packet stream...")
		var sentPackets int
		for {
			select {
			case <-ctx.Done():
				log.Println("[WT] Request context done. Stopping stream...")
				return
			case <-session.Context().Done():
				log.Println("[WT] Session context done. Stopping stream...")
				return
			case chunk, ok := <-ch:
				if !ok {
					log.Println("[WT] Broadcaster channel closed. Stopping stream...")
					return
				}
				if _, err := stream.Write(chunk); err != nil {
					log.Printf("[WT] Stream write error: %v", err)
					return
				}
				sentPackets++
				if sentPackets%100 == 0 {
					log.Printf("[WT] Sent 100 packets (Total: %d)", sentPackets)
				}
			}
		}
	}
}
