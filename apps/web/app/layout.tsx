import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/slur/tokens/colors.css";
import "./styles/slur/tokens/typography.css";
import "./styles/slur/tokens/spacing.css";
import "./styles/slur/tokens/radius.css";
import "./styles/slur/tokens/shadows.css";
import "./styles/slur/tokens/motion.css";
import "./styles/slur/tokens/breakpoints.css";
import "./styles/slur/tokens/z-index.css";
import "./styles/slur/global.css";
import "./styles/slur/components/button.css";
import "./styles/slur/components/input.css";
import "./styles/slur/components/card.css";
import "./styles/slur/components/alert.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SLUR",
  description: "SLUR 커머스 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
