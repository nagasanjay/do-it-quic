const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

/**
 * Sends updated network impairment values to the Go backend.
 * @param {number} packetLoss - Packet loss percentage (0-30)
 * @param {number} latency - Latency in milliseconds (0-300)
 * @returns {Promise<{status: string}>}
 */
export async function updateNetwork(packetLoss, latency) {
  const response = await fetch(`${API_BASE}/api/network`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ packet_loss: packetLoss, latency: latency }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Fetches the current network configuration from the Go backend.
 * @returns {Promise<{packet_loss: number, latency: number}>}
 */
export async function getNetworkConfig() {
  const response = await fetch(`${API_BASE}/api/network`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}
