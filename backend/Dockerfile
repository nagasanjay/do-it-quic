# ==========================================
# Do-It-QUIC Backend — Multi-stage Dockerfile
# ==========================================
# Requires NET_ADMIN capability for tc (traffic control) commands.
# Run with: docker compose up --build

# --- Stage 1: Build the Go binary ---
FROM golang:1.26-alpine AS builder

WORKDIR /build

# Copy source first so go mod tidy can inspect the code
COPY . .
RUN go get github.com/quic-go/webtransport-go@latest
RUN go mod tidy

# ponytail: compile natively for host architecture (supports OCI ARM64)
RUN CGO_ENABLED=0 GOOS=linux go build -o /build/server ./cmd/server.go

# --- Stage 2: Minimal runtime image ---
FROM alpine:3.20

# iproute2 provides the `tc` binary for netem traffic control
# sudo is used by the Go code to invoke tc with elevated privileges
RUN apk add --no-cache iproute2 sudo

WORKDIR /app

COPY --from=builder /build/server .

EXPOSE 8080

# Run as root so sudo/tc commands work without password prompts
ENTRYPOINT ["./server"]
