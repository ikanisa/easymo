"use client";

import "./globals.css";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EasyMO Real Estate",
  description: "Mobile-first shortlist viewer for the Real Estate AI agent.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
