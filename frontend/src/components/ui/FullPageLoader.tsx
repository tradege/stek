'use client';
import React from 'react';

export default function FullPageLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-accent-primary">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-accent-primary/20 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
        <span className="text-text-secondary text-sm animate-pulse">Loading...</span>
      </div>
    </div>
  );
}
