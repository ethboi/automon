'use client';

import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Three.js
const GameWorld = dynamic(
  () => import('@/components/world/GameWorld').then((mod) => mod.GameWorld),
  { ssr: false, loading: () => <WorldLoadingScreen /> }
);

function WorldLoadingScreen() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-6xl mb-4">🌍</div>
        <p className="text-gray-400">Loading world...</p>
      </div>
    </div>
  );
}

export default function Home() {
  return <GameWorld />;
}
