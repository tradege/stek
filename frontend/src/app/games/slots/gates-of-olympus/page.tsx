"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GatesOfOlympusRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/games/olympus");
  }, [router]);
  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-400 mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to Gates of Olympus...</p>
      </div>
    </div>
  );
}
