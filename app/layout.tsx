import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PhotoStory",
  description: "Turn your photos into a clean chronological story and print-ready PDF.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
