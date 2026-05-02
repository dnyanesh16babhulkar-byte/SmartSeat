import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SmartSeat — Book Smarter, Not Harder",
  description:
    "DSA-powered online ticket booking. Trie-accelerated search, Segment Tree availability, and real-time seat sync. Find the perfect seat instantly.",
  keywords: ["ticket booking", "segment tree", "trie", "DSA", "real-time", "seats"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}