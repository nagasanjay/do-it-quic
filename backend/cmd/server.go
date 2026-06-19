package main

import (
	"crypto/tls"
	"encoding/json"
	"log"
	"net/http"

	"do-it-quic-backend/internal/network"
	"github.com/quic-go/quic-go"
	"github.com/quic-go/quic-go/http3"
	"github.com/quic-go/webtransport-go"
)

func main() {
	netConfig := network.NewGlobalConfig()
	defer netConfig.ResetNetwork()

	// Generate TLS cert for WebTransport
	cert, certHash, err := network.GenerateEphemeralCert()
	if err != nil {
		log.Fatalf("Failed to generate cert: %v", err)
	}

	mux := http.NewServeMux()
	
	// API endpoints
	mux.HandleFunc("/api/network", network.HandleNetworkUpdate(netConfig))
	
	// Cert hash endpoint for frontend to connect to WT
	mux.HandleFunc("/api/cert", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		json.NewEncoder(w).Encode(map[string]string{"hash": certHash})
	})

	// WebSocket endpoint
	mux.HandleFunc("/ws", network.HandleWebSocketEcho())

	// WebTransport Server Setup
	wtServer := &webtransport.Server{
		H3: &http3.Server{
			Addr: ":8081",
			TLSConfig: &tls.Config{
				Certificates: []tls.Certificate{*cert},
				NextProtos:   []string{"h3"},
			},
			QUICConfig: &quic.Config{
				EnableDatagrams:                  true,
				EnableStreamResetPartialDelivery: true,
			},
			EnableDatagrams: true,
		},
		CheckOrigin: func(r *http.Request) bool { return true },
	}

	// Configure the HTTP/3 server for WebTransport
	webtransport.ConfigureHTTP3Server(wtServer.H3)
	
	wtMux := http.NewServeMux()
	wtMux.HandleFunc("/wt", func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[WT-MUX] Hit /wt endpoint. Method: %s, Proto: %s", r.Method, r.Header.Get("Sec-Webtransport-Http3-Draft"))
		network.HandleWebTransportEcho(wtServer)(w, r)
	})
	
	// Add logging middleware to H3 Handler
	wtServer.H3.Handler = http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("[H3-SERVER] Received Request: Method=%s, Path=%s, Proto=%s", r.Method, r.URL.Path, r.Proto)
		wtMux.ServeHTTP(w, r)
	})

	// Start WebTransport Server on port 8081
	go func() {
		log.Println("Starting WebTransport server on :8081 (HTTPS)...")
		if err := wtServer.ListenAndServe(); err != nil {
			log.Fatalf("WebTransport server failed: %v", err)
		}
	}()

	// Start HTTP/WebSocket server on port 8080
	port := ":8080"
	log.Printf("Starting core control server on port %s...\n", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}