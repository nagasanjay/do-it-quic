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
		conn, err := audioUpgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("Audio WS upgrade failed: %v", err)
			return
		}
		defer conn.Close()

		ch := b.Register()
		defer b.Unregister(ch)

		for chunk := range ch {
			if err := conn.WriteMessage(websocket.BinaryMessage, chunk); err != nil {
				break
			}
		}
	}
}

// HandleAudioWebTransport upgrades connection to WebTransport, opens a unidirectional stream, and streams raw PCM
func HandleAudioWebTransport(wtServer *webtransport.Server, b *audio.Broadcaster) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		session, err := wtServer.Upgrade(w, r)
		if err != nil {
			log.Printf("Audio WebTransport upgrade failed: %v", err)
			return
		}

		ctx := r.Context()

		// ponytail: Open a single reliable unidirectional stream to push audio packets down
		stream, err := session.OpenUniStream()
		if err != nil {
			log.Printf("Failed to open unidirectional stream: %v", err)
			session.CloseWithError(0, "failed to open stream")
			return
		}
		defer stream.Close()

		ch := b.Register()
		defer b.Unregister(ch)

		for {
			select {
			case <-ctx.Done():
				return
			case <-session.Context().Done():
				return
			case chunk, ok := <-ch:
				if !ok {
					return
				}
				if _, err := stream.Write(chunk); err != nil {
					log.Printf("WebTransport stream write error: %v", err)
					return
				}
			}
		}
	}
}
