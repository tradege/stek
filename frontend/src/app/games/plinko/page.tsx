'use client';
import PlinkoGame from '@/components/games/plinko/PlinkoGame';
import ErrorBoundary from '@/components/ErrorBoundary';
export default function PlinkoPage() {
  return (
    <ErrorBoundary gameName="Plinko">
      <PlinkoGame />
    </ErrorBoundary>
  );
}
