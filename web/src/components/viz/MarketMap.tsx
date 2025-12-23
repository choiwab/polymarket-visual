'use client';

import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { MarketNode } from '@/lib/types';
import { useMarketData } from '@/hooks/useMarketData';
import clsx from 'clsx';
import { ExternalLink } from 'lucide-react';

interface MarketMapProps {
    minVolume?: number;
}

export default function MarketMap({ minVolume = 1000 }: MarketMapProps) {
    const { markets, isLoading } = useMarketData();

    // Filter and Process Data
    const root = useMemo(() => {
        if (!markets.length) return null;

        const filtered = markets.filter((m) => m.volume >= minVolume);

        // Create hierarchy
        // We group everything under a single "root"
        const hierarchyData = {
            name: 'root',
            children: filtered,
        };

        const rootNode = d3.hierarchy(hierarchyData)
            .sum((d: any) => d.volume) // Size by volume
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        // Compute layout
        // We'll compute normalized coordinates (0-100%) and let CSS handle the actual pixels.
        const treemapLayout = d3.treemap()
            .size([100, 100]) // Output percentages directly
            .paddingInner(0.2)
            .round(false)
            .tile(d3.treemapSquarify);

        treemapLayout(rootNode);

        return rootNode;
    }, [markets, minVolume]);

    // Color Scale
    // 0 -> Red (No), 1 -> Blue (Yes)
    const colorScale = (prob: number) => {
        return d3.interpolateRgb("rgb(239, 68, 68)", "rgb(59, 130, 246)")(prob);
    };

    if (isLoading && !markets.length) {
        return (
            <div className="flex items-center justify-center h-full w-full text-zinc-400 animate-pulse">
                Loading Market Data...
            </div>
        );
    }

    if (!root || !root.leaves().length) {
        return (
            <div className="flex items-center justify-center h-full w-full text-zinc-500">
                No active markets found above volume threshold.
            </div>
        );
    }

    return (
        <div className="relative w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl">
            {root.leaves().map((leaf: any) => {
                const market = leaf.data as MarketNode;
                const width = leaf.x1 - leaf.x0;
                const height = leaf.y1 - leaf.y0;

                // Skip tiny boxes
                if (width < 2 || height < 2) return null;

                return (
                    <a
                        key={market.id}
                        href={`https://polymarket.com/event/${market.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute transition-all duration-700 ease-in-out hover:z-10 group"
                        style={{
                            left: `${leaf.x0}%`,
                            top: `${leaf.y0}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            backgroundColor: colorScale(market.outcomeProb),
                        }}
                    >
                        <div
                            className="w-full h-full opacity-0 hover:opacity-100 transition-opacity bg-black/20 absolute top-0 left-0 border-2 border-white/50"
                        />

                        {/* Content if big enough */}
                        <div className="relative p-1 h-full w-full text-white overflow-hidden pointer-events-none">
                            {(width > 5 && height > 5) && (
                                <div className="flex flex-col h-full">
                                    <span className="font-bold text-[10px] md:text-xs leading-none line-clamp-2 drop-shadow-md">
                                        {market.question}
                                    </span>
                                    <div className="mt-auto flex items-end justify-between">
                                        <span className="text-[10px] font-mono opacity-90 drop-shadow-md">
                                            {Math.round(market.outcomeProb * 100)}%
                                        </span>
                                        {(width > 10) && (
                                            <span className="text-[9px] opacity-70">
                                                ${d3.format(".2s")(market.volume)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </a>
                );
            })}
        </div>
    );
}
