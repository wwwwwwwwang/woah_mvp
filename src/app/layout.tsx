import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "病原情报平台 MVP",
  description: "面向尼帕病毒、H5N1、裂谷热和新疆出血热的官方数据整合与检索平台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <div className="app-shell">
          <header className="site-header">
            <div className="container site-header__inner">
              <div>
                <p className="eyebrow">官方来源: WOAH / WHO / NCBI / China CDC</p>
                <Link href="/" className="site-title">
                  病原情报平台 MVP
                </Link>
              </div>
              <nav className="site-nav">
                <Link href="/">总览</Link>
                <Link href="/visualization">态势大屏</Link>
                <Link href="/sequences">序列检索</Link>
                <Link href="/outbreaks">疫情检索</Link>
                <Link href="/admin/sync">数据同步</Link>
              </nav>
            </div>
          </header>
          <main className="container page-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
