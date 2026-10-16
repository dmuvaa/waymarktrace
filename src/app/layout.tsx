import type { Metadata } from "next";
import { DM_Sans, Newsreader } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Waymarktrace — Read the map. Name the person.",
  description:
    "A map-based history game. Identify notable lives from their birth and death places.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${newsreader.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
