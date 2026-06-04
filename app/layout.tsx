import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

const DESCRIPTION =
  "Build ASCII directory structures quickly. A keyboard-driven tree editor that renders clean ├── └── trees to copy into docs and AI-agent prompts.";

export const metadata: Metadata = {
  metadataBase: new URL("https://tree.continuous.supply"),
  title: {
    default: "tree — build ASCII directory structures quickly",
    template: "%s · tree",
  },
  description: DESCRIPTION,
  applicationName: "tree",
  keywords: [
    "ascii tree",
    "directory tree",
    "tree generator",
    "folder structure",
    "markdown tree",
    "developer tools",
  ],
  authors: [{ name: "Troels Abrahamsen" }],
  openGraph: {
    type: "website",
    url: "https://tree.continuous.supply",
    siteName: "tree",
    title: "tree — build ASCII directory structures quickly",
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "tree — build ASCII directory structures quickly",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
