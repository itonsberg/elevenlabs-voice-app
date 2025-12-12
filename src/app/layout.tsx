import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/header";

export const metadata: Metadata = {
  title: "ElevenLabs Voice AI",
  description: "Voice AI with browser automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Header />
        <div className="pt-14">
          {children}
        </div>
      </body>
    </html>
  );
}
