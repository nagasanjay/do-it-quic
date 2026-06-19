import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Do-It-QUIC | Network Control",
  description:
    "Real-time network impairment controller for testing QUIC protocol behavior under degraded conditions. Adjust packet loss and latency with precision.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="top-nav">
          <Link href="/" className="nav-link">Control Panel</Link>
          <Link href="/whiteboard" className="nav-link">Protocol Whiteboard</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
