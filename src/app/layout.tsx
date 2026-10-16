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
  title: "Waymarktrace — Name the historical figure.",
  description:
    "Trace the historical figure given their birth and death places, alongside the respective years.",
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
