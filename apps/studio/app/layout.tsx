import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creator Studio — Video",
  description: "AI faceless-video factory: script → voice → B-roll → captions",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <main style={{ padding: "20px 28px", maxWidth: 1400, margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
