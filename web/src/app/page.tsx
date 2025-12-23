'use client';

import React, { useState } from 'react';
import MarketMap from '@/components/viz/MarketMap';
import { Settings2 } from 'lucide-react';

export default function Home() {
  const [minVolume, setMinVolume] = useState(5000);

  return (
    <main className="flex h-screen flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
            P
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Polymarket <span className="font-light text-zinc-500">Live Map</span>
          </h1>
        </div>

        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <Settings2 className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Min Volume:</span>
            <input
              type="range"
              min="1000"
              max="10000000"
              step="100000"
              value={minVolume}
              onChange={(e) => setMinVolume(Number(e.target.value))}
              className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
            />
            <span className="font-mono text-zinc-300 w-16 text-right">${(minVolume / 1000000).toFixed(1)}M</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 relative w-full overflow-hidden">
        <div className="w-full h-full">
          <MarketMap minVolume={minVolume} />
        </div>
      </div>
    </main>
  );
}
