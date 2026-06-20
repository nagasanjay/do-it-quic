package network

import (
	"encoding/json"
	"net/http"
	"strings"
)

type UpdateRequest struct {
	PacketLoss int `json:"packet_loss"`
	Latency    int `json:"latency"`
}

// Allowed origins for CORS (Next.js dev server)
var allowedOrigins = map[string]bool{
	"http://localhost:3000":   true,
	"http://127.0.0.1:3000":  true,
}

// HandleNetworkUpdate returns an http.HandlerFunc injected with the global config.
func HandleNetworkUpdate(config *GlobalConfig) http.HandlerFunc {
	return func(responseWriter http.ResponseWriter, request *http.Request) {
		origin := request.Header.Get("Origin")

		// Only set CORS headers if the origin is whitelisted
		if allowedOrigins[origin] || strings.HasSuffix(origin, ".nagasanjay.com") {
			responseWriter.Header().Set("Access-Control-Allow-Origin", origin)
			responseWriter.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if request.Method == http.MethodOptions {
			responseWriter.WriteHeader(http.StatusOK)
			return
		}

		if request.Method == http.MethodGet {
			// Return the current network configuration
			config.mutex.RLock()
			currentConfig := UpdateRequest{
				PacketLoss: config.PacketLoss,
				Latency:    config.Latency,
			}
			config.mutex.RUnlock()

			responseWriter.Header().Set("Content-Type", "application/json")
			json.NewEncoder(responseWriter).Encode(currentConfig)
			return
		}

		if request.Method != http.MethodPost {
			http.Error(responseWriter, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var updateRequest UpdateRequest
		if err := json.NewDecoder(request.Body).Decode(&updateRequest); err != nil {
			http.Error(responseWriter, "Invalid JSON payload", http.StatusBadRequest)
			return
		}

		// Apply the updates to the system
		if err := config.UpdateAndApply(updateRequest.PacketLoss, updateRequest.Latency); err != nil {
			http.Error(responseWriter, "Failed to apply network configuration", http.StatusInternalServerError)
			return
		}

		responseWriter.Header().Set("Content-Type", "application/json")
		responseWriter.WriteHeader(http.StatusOK)
		json.NewEncoder(responseWriter).Encode(map[string]string{"status": "success"})
	}
}