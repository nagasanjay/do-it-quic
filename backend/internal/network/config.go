package network

import (
	"fmt"
	"log"
	"os/exec"
	"sync"
)

// GlobalConfig holds the shared network parameters safely.
type GlobalConfig struct {
	mutex      sync.RWMutex
	PacketLoss int // Percentage (0-35)
	Latency    int // Milliseconds (0-300)
}

const MAX_PACKET_LOSS = 30
const MAX_LATENCY = 300

// NewGlobalConfig initializes a clean network state.
func NewGlobalConfig() *GlobalConfig {
	globalConfig := &GlobalConfig{}
	globalConfig.ResetNetwork()
	return globalConfig
}

// UpdateAndApply locks the state, updates values, and executes the system command.
func (globalConfig *GlobalConfig) UpdateAndApply(loss, latency int) error {
	globalConfig.mutex.Lock()
	defer globalConfig.mutex.Unlock()

	// Hardcapped limits to prevent locking yourself out of the VM
	if loss < 0 || loss > MAX_PACKET_LOSS {
		loss = MAX_PACKET_LOSS
	}
	if latency < 0 || latency > MAX_LATENCY {
		latency = MAX_LATENCY
	}

	globalConfig.PacketLoss = loss
	globalConfig.Latency = latency

	return globalConfig.applyTCRules()
}

// applyTCRules clears old rules and applies the new netem constraints.
// IMPORTANT: This requires the host binary to run with root/sudo privileges.
func (globalConfig *GlobalConfig) applyTCRules() error {
	// 1. Always clear existing rules first to avoid conflicts
	_ = exec.Command("sudo", "tc", "qdisc", "del", "dev", "eth0", "root").Run()

	// If both are 0, we just want a clean network
	if globalConfig.PacketLoss == 0 && globalConfig.Latency == 0 {
		log.Println("Network rules cleared. Running perfectly.")
		return nil
	}

	// 2. Build the new netem command
	commandArguments := []string{"tc", "qdisc", "add", "dev", "eth0", "root", "netem"}
	
	if globalConfig.Latency > 0 {
		commandArguments = append(commandArguments, "delay", fmt.Sprintf("%dms", globalConfig.Latency))
	}
	if globalConfig.PacketLoss > 0 {
		commandArguments = append(commandArguments, "loss", fmt.Sprintf("%d%%", globalConfig.PacketLoss))
	}

	cmd := exec.Command("sudo", commandArguments...)
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to apply tc rules: %w", err)
	}

	log.Printf("Applied network rules: Latency %dms, Loss %d%%", globalConfig.Latency, globalConfig.PacketLoss)
	return nil
}

// ResetNetwork provides a fail-safe to wipe all constraints.
func (globalConfig *GlobalConfig) ResetNetwork() {
	globalConfig.mutex.Lock()
	defer globalConfig.mutex.Unlock()
	globalConfig.PacketLoss = 0
	globalConfig.Latency = 0
	_ = exec.Command("sudo", "tc", "qdisc", "del", "dev", "eth0", "root").Run()
}