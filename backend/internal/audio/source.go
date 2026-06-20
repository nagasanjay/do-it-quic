package audio

import (
	"log"
	"math"
	"os"
	"sync"
	"time"
)

const (
	SampleRate     = 16000
	ChunkSamples   = 512
	BytesPerSample = 2
	ChunkSize      = ChunkSamples * BytesPerSample
)

type Broadcaster struct {
	mu        sync.RWMutex
	listeners map[chan []byte]bool
}

func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		listeners: make(map[chan []byte]bool),
	}
}

func (b *Broadcaster) Start() {
	log.Println("[AUDIO-SOURCE] Starting audio broadcaster loop...")
	go b.streamLoop()
}

func (b *Broadcaster) Register() chan []byte {
	b.mu.Lock()
	defer b.mu.Unlock()

	log.Println("[AUDIO-SOURCE] Registering new listener...")
	ch := make(chan []byte, 128) // Buffer size 128 allows ~4 seconds of buffer space
	b.listeners[ch] = true
	log.Printf("[AUDIO-SOURCE] Listener registered. Active listeners: %d", len(b.listeners))
	return ch
}

func (b *Broadcaster) Unregister(ch chan []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	log.Println("[AUDIO-SOURCE] Unregistering listener...")
	if _, ok := b.listeners[ch]; ok {
		delete(b.listeners, ch)
		close(ch)
	}
	log.Printf("[AUDIO-SOURCE] Listener unregistered. Active listeners: %d", len(b.listeners))
}

func (b *Broadcaster) streamLoop() {
	ticker := time.NewTicker(32 * time.Millisecond)
	defer ticker.Stop()

	// Try loading WAV file if present
	wavData, err := loadWavData("audio.wav")
	if err == nil {
		log.Println("[AUDIO-SOURCE] Loaded audio.wav successfully")
	} else {
		log.Printf("[AUDIO-SOURCE] Failed to load audio.wav (falling back to synth arpeggiator): %v", err)
	}
	var fileIndex int

	notes := []float64{261.63, 329.63, 392.00, 523.25} // C4, E4, G4, C5
	var sampleIndex int64

	for range ticker.C {
		chunk := make([]byte, ChunkSize)

		if err == nil && len(wavData) > 0 {
			// ponytail: loop WAV file raw samples
			for i := 0; i < ChunkSize; i++ {
				chunk[i] = wavData[fileIndex]
				fileIndex = (fileIndex + 1) % len(wavData)
			}
		} else {
			// Generate pleasant arpeggiator
			t := float64(sampleIndex) / SampleRate
			noteIdx := int(t * 2) % len(notes) // change every 500ms
			freq := notes[noteIdx]

			for i := 0; i < ChunkSamples; i++ {
				st := float64(sampleIndex) / SampleRate
				val := math.Sin(2 * math.Pi * freq * st)
				sample := int16(val * 12000.0) // medium volume

				chunk[i*2] = byte(sample & 0xFF)
				chunk[i*2+1] = byte((sample >> 8) & 0xFF)
				sampleIndex++
			}
		}

		// Broadcast to all active listeners
		b.mu.RLock()
		for ch := range b.listeners {
			select {
			case ch <- chunk:
			default:
				// ponytail: drop chunk if receiver is slow
			}
		}
		b.mu.RUnlock()
	}
}

func loadWavData(filename string) ([]byte, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	if stat.Size() <= 44 {
		return nil, os.ErrInvalid
	}

	// Read all file data
	data := make([]byte, stat.Size())
	if _, err := file.Read(data); err != nil {
		return nil, err
	}

	// ponytail: Skip standard 44-byte WAV header
	return data[44:], nil
}
