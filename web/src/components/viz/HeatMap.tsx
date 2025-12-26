'use client';

import React, { useMemo } from 'react';
import * as d3 from 'd3';
import { ViewLevel, Category, ProcessedEvent, MarketNode } from '@/lib/types';

// ============================================
// Types
// ============================================

interface HeatMapNode {
    id: string;
    name: string;
    value: number; // For sizing
    heat: number; // 0-1 for coloring
    probability?: number; // Only for markets
    slug?: string;
}

interface HeatMapProps {
    level: ViewLevel;
    data: Category[] | ProcessedEvent[] | MarketNode[];
    onNodeClick?: (node: HeatMapNode) => void;
    minVolume?: number;
}

// ============================================
// Color Scales
// ============================================

// Heat color scale: Green (cold/low activity) → Yellow → Red (hot/high activity)
const heatColorScale = (heat: number): string => {
    // Clamp heat to 0-1
    const h = Math.min(Math.max(heat, 0), 1);

    if (h < 0.5) {
        // Green to Yellow (low to medium activity)
        return d3.interpolateRgb('#22c55e', '#eab308')(h * 2);
    } else {
        // Yellow to Red (medium to high activity)
        return d3.interpolateRgb('#eab308', '#ef4444')((h - 0.5) * 2);
    }
};

// Probability color scale: Red (NO) → Blue (YES)
const probabilityColorScale = (prob: number): string => {
    return d3.interpolateRgb('rgb(239, 68, 68)', 'rgb(59, 130, 246)')(prob);
};

// ============================================
// Data Transformation
// ============================================

function transformToNodes(
    level: ViewLevel,
    data: Category[] | ProcessedEvent[] | MarketNode[]
): HeatMapNode[] {
    switch (level) {
        case 'category':
            return (data as Category[]).map((cat) => ({
                id: cat.id,
                name: cat.name,
                value: cat.volumeTotal,
                heat: cat.volumeHeat,
            }));

        case 'event':
            return (data as ProcessedEvent[]).map((event) => ({
                id: event.id,
                name: event.title,
                value: event.volumeTotal,
                heat: event.volumeHeat,
                slug: event.slug,
            }));

        case 'market':
            return (data as MarketNode[]).map((market) => ({
                id: market.id,
                name: market.question,
                value: market.volume,
                heat: 0, // Not used for markets
                probability: market.outcomeProb,
                slug: market.slug,
            }));

        default:
            return [];
    }
}

// ============================================
// Component
// ============================================

export default function HeatMap({
    level,
    data,
    onNodeClick,
    minVolume = 0,
}: HeatMapProps) {
    // Transform and filter data
    const root = useMemo(() => {
        const nodes = transformToNodes(level, data).filter(
            (n) => n.value >= minVolume
        );

        if (nodes.length === 0) return null;

        interface HierarchyData {
            name: string;
            children?: HeatMapNode[];
            value?: number;
        }

        const hierarchyData: HierarchyData = {
            name: 'root',
            children: nodes,
        };

        const rootNode = d3
            .hierarchy<HierarchyData>(hierarchyData)
            .sum((d) => d.value || 0)
            .sort((a, b) => (b.value || 0) - (a.value || 0));

        const treemapLayout = d3
            .treemap<HierarchyData>()
            .size([100, 100])
            .paddingInner(0.3)
            .round(false)
            .tile(d3.treemapSquarify);

        treemapLayout(rootNode);

        return rootNode as d3.HierarchyRectangularNode<HierarchyData>;
    }, [level, data, minVolume]);

    // Get color for a node based on level
    const getNodeColor = (node: HeatMapNode): string => {
        if (level === 'market' && node.probability !== undefined) {
            return probabilityColorScale(node.probability);
        }
        return heatColorScale(node.heat);
    };

    // Handle node click
    const handleClick = (
        e: React.MouseEvent,
        node: HeatMapNode,
        isMarketLevel: boolean
    ) => {
        if (isMarketLevel && node.slug) {
            // Markets open Polymarket directly
            window.open(`https://polymarket.com/event/${node.slug}`, '_blank');
        } else if (onNodeClick) {
            e.preventDefault();
            onNodeClick(node);
        }
    };

    // Loading state
    if (!root || !root.leaves().length) {
        return (
            <div className="flex items-center justify-center h-full w-full text-zinc-500">
                {data.length === 0
                    ? 'No data available'
                    : 'No items above volume threshold'}
            </div>
        );
    }

    const isMarketLevel = level === 'market';

    return (
        <div className="relative w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl">
            {root.leaves().map((leaf) => {
                const node = leaf.data as HeatMapNode;
                const width = leaf.x1 - leaf.x0;
                const height = leaf.y1 - leaf.y0;

                // Skip tiny boxes
                if (width < 2 || height < 2) return null;

                const color = getNodeColor(node);
                const Element = isMarketLevel ? 'a' : 'button';

                const elementProps = isMarketLevel
                    ? {
                          href: `https://polymarket.com/event/${node.slug}`,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                      }
                    : {
                          onClick: (e: React.MouseEvent) =>
                              handleClick(e, node, false),
                      };

                return (
                    <Element
                        key={node.id}
                        {...elementProps}
                        className="absolute transition-all duration-500 ease-in-out hover:z-10 group cursor-pointer text-left"
                        style={{
                            left: `${leaf.x0}%`,
                            top: `${leaf.y0}%`,
                            width: `${width}%`,
                            height: `${height}%`,
                            backgroundColor: color,
                        }}
                    >
                        {/* Hover overlay */}
                        <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 absolute top-0 left-0 border-2 border-white/50" />

                        {/* Content */}
                        <div className="relative p-1.5 h-full w-full text-white overflow-hidden pointer-events-none">
                            {width > 5 && height > 5 && (
                                <div className="flex flex-col h-full">
                                    {/* Title */}
                                    <span className="font-bold text-[10px] md:text-xs leading-tight line-clamp-3 drop-shadow-md">
                                        {node.name}
                                    </span>

                                    {/* Stats at bottom */}
                                    <div className="mt-auto flex items-end justify-between gap-1">
                                        {/* Probability for markets, Heat indicator for others */}
                                        {isMarketLevel &&
                                        node.probability !== undefined ? (
                                            <span className="text-[10px] font-mono font-bold opacity-90 drop-shadow-md">
                                                {Math.round(
                                                    node.probability * 100
                                                )}
                                                %
                                            </span>
                                        ) : (
                                            width > 8 && (
                                                <span
                                                    className="text-[9px] opacity-70"
                                                    title="Activity level"
                                                >
                                                    {node.heat > 0.7
                                                        ? '🔥'
                                                        : node.heat > 0.4
                                                        ? '⚡'
                                                        : ''}
                                                </span>
                                            )
                                        )}

                                        {/* Volume */}
                                        {width > 8 && (
                                            <span className="text-[9px] opacity-70 font-mono">
                                                ${d3.format('.2s')(node.value)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Element>
                );
            })}
        </div>
    );
}
