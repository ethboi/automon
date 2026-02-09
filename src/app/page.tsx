'use client';

import { GameWorld } from '@/components/world/GameWorld';

export default function Home() {
  return (
    <div className="fixed inset-0 w-full h-full">
      <GameWorld />
    </div>
  );
}
