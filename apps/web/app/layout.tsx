import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineReady } from "./offline-ready";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "LearnLanguage", template: "%s · LearnLanguage" },
  description: "一套引擎，学习任何语言。 One engine for any language.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "LearnLanguage 课程工作台",
    description: "一套引擎，学习任何语言。 One engine for any language.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main-content">跳到主要内容 / Skip to main content</a>
        <div id="main-content" tabIndex={-1}>{children}</div>
        <OfflineReady />
      </body>
    </html>
  );
}
