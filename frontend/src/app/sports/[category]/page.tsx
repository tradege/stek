"use client";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MainLayout from "@/components/layout/MainLayout";

const sportData: Record<string, { icon: string; name: string; color: string }> = {
  football: { icon: "⚽", name: "Football", color: "from-green-500/20 to-green-600/10" },
  basketball: { icon: "🏀", name: "Basketball", color: "from-orange-500/20 to-orange-600/10" },
  tennis: { icon: "🎾", name: "Tennis", color: "from-yellow-500/20 to-yellow-600/10" },
  esports: { icon: "🎮", name: "eSports", color: "from-purple-500/20 to-purple-600/10" },
  mma: { icon: "🥊", name: "MMA / UFC", color: "from-red-500/20 to-red-600/10" },
  racing: { icon: "🏎️", name: "Racing", color: "from-blue-500/20 to-blue-600/10" },
};

export default function SportCategoryPage() {
  const params = useParams();
  const category = params?.category as string;
  const sport = sportData[category] || { icon: "🏆", name: category, color: "from-accent-primary/20 to-accent-primary/10" };

  return (
    <MainLayout>
    <div className="min-h-screen p-4 lg:p-8 flex items-center justify-center">
      <div className="max-w-lg w-full text-center">
        <div className={`rounded-2xl bg-gradient-to-br ${sport.color} border border-white/10 p-12`}>
          <span className="text-7xl block mb-6">{sport.icon}</span>
          <h1 className="text-3xl font-bold text-white mb-3">{sport.name}</h1>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/20 rounded-full mb-6">
            <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            <span className="text-accent-primary text-sm font-semibold">COMING SOON</span>
          </div>
          <p className="text-text-secondary mb-8">
            Live betting for {sport.name} is coming soon. Stay tuned for the best odds and markets.
          </p>
          <Link
            href="/sports"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary hover:bg-accent-primary/90 text-black font-semibold rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Sports
          </Link>
        </div>
      </div>
    </div>
    </MainLayout>
  );
}
