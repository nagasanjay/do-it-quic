package network

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"math/big"
	"net"
	"time"
)

// GenerateEphemeralCert creates a short-lived self-signed certificate and returns it along with its SHA-256 hash.
// This hash is used by WebTransport's serverCertificateHashes to allow connections to localhost.
func GenerateEphemeralCert() (*tls.Certificate, string, error) {
	// Generate an ECDSA P-256 key pair (most compatible for WebTransport)
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, "", err
	}

	// Create a short-lived certificate template (must be <= 14 days for WebTransport)
	template := x509.Certificate{
		SerialNumber: big.NewInt(time.Now().UnixNano()),
		Subject: pkix.Name{
			Organization: []string{"Do-It-QUIC Local Dev"},
		},
		NotBefore: time.Now().Add(-1 * time.Hour),
		NotAfter:  time.Now().Add(10 * 24 * time.Hour),

		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageKeyEncipherment,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  false,
		DNSNames:              []string{"localhost"},
		IPAddresses:           []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")},
	}

	// Create the certificate
	certDER, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		return nil, "", err
	}

	// Calculate the SHA-256 hash of the DER-encoded certificate
	hashBytes := sha256.Sum256(certDER)
	
	// Create the tls.Certificate
	cert := &tls.Certificate{
		Certificate: [][]byte{certDER},
		PrivateKey:  priv,
	}

	return cert, base64.StdEncoding.EncodeToString(hashBytes[:]), nil
}
