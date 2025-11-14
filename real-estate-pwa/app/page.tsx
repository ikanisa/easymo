"use client";

import Link from "next/link";
import { FeaturedProperties } from "@/components/property/FeaturedProperties";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-10">
      <header className="space-y-3 rounded-3xl border border-white/40 bg-white/80 p-6 shadow-xl backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
          Real Estate Agent
        </p>
        <h1 className="text-4xl font-semibold text-slate-900">
          Continue your shortlist anywhere.
        </h1>
        <p className="text-lg text-slate-600">
          Compare rentals, track owner responses, and sync updates back to WhatsApp with one tap.
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-slate-500">
          <span>🔐 Anonymous login</span>
          <span>📍 Geo-personalized matches</span>
          <span>⚡ 15s refresh cadence</span>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/chat"
            className="inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
          >
            Jump back into chat →
          </Link>
          <button
            type="button"
            className="inline-flex items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Download shortlist
          </button>
        </div>
      </header>

      <FeaturedProperties />
    </main>
  );
}
