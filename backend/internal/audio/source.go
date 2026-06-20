package audio

import (
	"math"
	"os"
	"time"
)

const (
	SampleRate     = 16000
	ChunkSamples   = 512
	BytesPerSample = 2
	ChunkSize      = ChunkSamples * BytesPerSample
)

type Broadcaster struct {
	listeners  map[chan []byte]bool
	register   chan chan []byte
	unregister chan chan []byte
	data       chan []byte
}

func NewBroadcaster() *Broadcaster {
	return &Broadcaster{
		listeners:  make(map[chan []byte]bool),
		register:   make(chan chan []byte),
		unregister: make(chan chan []byte),
		data:       make(chan []byte),
	}
}

func (b *Broadcaster) Start() {
	go b.run()
	go b.streamLoop()
}

func (b *Broadcaster) Register() chan []byte {
	ch := make(chan []byte, 64)
	b.register <- ch
	return ch
}

func (b *Broadcaster) Unregister(ch chan []byte) {
	b.unregister <- ch
}

func (b *Broadcaster) run() {
	for {
		select {
		case ch := <-b.register:
			b.listeners[ch] = true
		case ch := <-b.unregister:
			delete(b.listeners, ch)
			close(ch)
		case chunk := <-b.data:
			for ch := range b.listeners {
				select {
				case ch <- chunk:
				default:
					// ponytail: drop chunk if receiver is slow
				}
			}
		}
	}
}

func (b *Broadcaster) streamLoop() {
	ticker := time.NewTicker(32 * time.Millisecond)
	defer ticker.Stop()

	// Try loading WAV file if present
	wavData, err := loadWavData("audio.wav")
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

		b.data <- chunk
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
