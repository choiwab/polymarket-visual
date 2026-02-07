'use client';

import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import { ViewLevel, Category, ProcessedEvent, MarketNode } from '@/lib/types';
import { RotateCcw } from 'lucide-react';

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

interface Viewport {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
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
                slug: market.eventSlug || market.slug,
            }));

        default:
            return [];
    }
}

// ============================================
// Constants
// ============================================

const DEFAULT_VIEWPORT: Viewport = { x0: 0, y0: 0, x1: 100, y1: 100 };
const MIN_VIEWPORT_SIZE = 5; // Minimum viewport dimension (max zoom ~20x)
const ZOOM_FACTOR = 0.85; // How much viewport shrinks per scroll tick

// ============================================
// Component
// ============================================

export default function HeatMap({
    level,
    data,
    onNodeClick,
    minVolume = 0,
}: HeatMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);

    // Drag state
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const dragStartViewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);
    const dragDistanceRef = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    // Keep ref in sync
    useEffect(() => {
        viewportRef.current = viewport;
    }, [viewport]);

    // Reset viewport when level or data changes
    useEffect(() => {
        setViewport(DEFAULT_VIEWPORT);
        viewportRef.current = DEFAULT_VIEWPORT;
    }, [level, data]);

    // Computed zoom level
    const zoomLevel = 100 / (viewport.x1 - viewport.x0);
    const isZoomed = zoomLevel > 1.05;

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

    // Clamp viewport to stay within bounds
    const clampViewport = useCallback((vp: Viewport): Viewport => {
        const w = vp.x1 - vp.x0;
        const h = vp.y1 - vp.y0;
        let x0 = vp.x0;
        let y0 = vp.y0;

        // Clamp position so viewport stays within 0-100
        x0 = Math.max(0, Math.min(100 - w, x0));
        y0 = Math.max(0, Math.min(100 - h, y0));

        return { x0, y0, x1: x0 + w, y1: y0 + h };
    }, []);

    // Wheel handler for zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            const rect = container.getBoundingClientRect();
            // Cursor position as fraction of container (0-1)
            const cursorXFrac = (e.clientX - rect.left) / rect.width;
            const cursorYFrac = (e.clientY - rect.top) / rect.height;

            const vp = viewportRef.current;
            const vpW = vp.x1 - vp.x0;
            const vpH = vp.y1 - vp.y0;

            // Point in treemap coordinates under cursor
            const cursorTreeX = vp.x0 + cursorXFrac * vpW;
            const cursorTreeY = vp.y0 + cursorYFrac * vpH;

            // Zoom direction
            const zoomIn = e.deltaY < 0;
            const factor = zoomIn ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;

            let newW = vpW * factor;
            let newH = vpH * factor;

            // Clamp to min/max size
            if (newW < MIN_VIEWPORT_SIZE) {
                newW = MIN_VIEWPORT_SIZE;
                newH = MIN_VIEWPORT_SIZE * (vpH / vpW);
            }
            if (newW > 100) {
                newW = 100;
                newH = 100;
            }

            // Keep cursor point fixed in screen space
            const newX0 = cursorTreeX - cursorXFrac * newW;
            const newY0 = cursorTreeY - cursorYFrac * newH;

            const newVp = clampViewport({
                x0: newX0,
                y0: newY0,
                x1: newX0 + newW,
                y1: newY0 + newH,
            });

            viewportRef.current = newVp;
            setViewport(newVp);
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => container.removeEventListener('wheel', handleWheel);
    }, [clampViewport]);

    // Drag handlers for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isZoomed) return;
        // Only initiate drag on primary button
        if (e.button !== 0) return;

        isDraggingRef.current = true;
        dragDistanceRef.current = 0;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        dragStartViewportRef.current = { ...viewportRef.current };
        setIsDragging(true);
        e.preventDefault();
    }, [isZoomed]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDraggingRef.current || !containerRef.current) return;

        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);

        const rect = containerRef.current.getBoundingClientRect();
        const svp = dragStartViewportRef.current;
        const vpW = svp.x1 - svp.x0;
        const vpH = svp.y1 - svp.y0;

        // Convert pixel drag to treemap coordinate delta
        const treeDx = -(dx / rect.width) * vpW;
        const treeDy = -(dy / rect.height) * vpH;

        const newVp = clampViewport({
            x0: svp.x0 + treeDx,
            y0: svp.y0 + treeDy,
            x1: svp.x0 + treeDx + vpW,
            y1: svp.y0 + treeDy + vpH,
        });

        viewportRef.current = newVp;
        setViewport(newVp);
    }, [clampViewport]);

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        setIsDragging(false);
    }, []);

    // Global mouseup to catch drag release outside container
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isDraggingRef.current) {
                isDraggingRef.current = false;
                setIsDragging(false);
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    const resetZoom = useCallback(() => {
        setViewport(DEFAULT_VIEWPORT);
        viewportRef.current = DEFAULT_VIEWPORT;
    }, []);

    // Get color for a node based on level
    const getNodeColor = (node: HeatMapNode): string => {
        if (level === 'market' && node.probability !== undefined) {
            return probabilityColorScale(node.probability);
        }
        return heatColorScale(node.heat);
    };

    // Handle node click (only if not dragging)
    const handleClick = (
        e: React.MouseEvent,
        node: HeatMapNode,
        isMarketLevel: boolean
    ) => {
        // Suppress click if user was dragging
        if (dragDistanceRef.current > 3) {
            e.preventDefault();
            return;
        }

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
    const vpW = viewport.x1 - viewport.x0;
    const vpH = viewport.y1 - viewport.y0;

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl ${
                isZoomed
                    ? isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    : ''
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        >
            {root.leaves().map((leaf) => {
                const node = leaf.data as HeatMapNode;
                const cellW = leaf.x1 - leaf.x0;
                const cellH = leaf.y1 - leaf.y0;

                // Map cell from treemap coords to viewport-relative screen coords
                const screenLeft = ((leaf.x0 - viewport.x0) / vpW) * 100;
                const screenTop = ((leaf.y0 - viewport.y0) / vpH) * 100;
                const screenW = (cellW / vpW) * 100;
                const screenH = (cellH / vpH) * 100;

                // Skip cells fully outside viewport
                if (
                    leaf.x1 <= viewport.x0 ||
                    leaf.x0 >= viewport.x1 ||
                    leaf.y1 <= viewport.y0 ||
                    leaf.y0 >= viewport.y1
                ) {
                    return null;
                }

                // Skip cells too small on screen (< 1% of viewport)
                if (screenW < 1 || screenH < 1) return null;

                const color = getNodeColor(node);
                const Element = isMarketLevel ? 'a' : 'button';

                const elementProps = isMarketLevel
                    ? {
                          href: `https://polymarket.com/event/${node.slug}`,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          onClick: (e: React.MouseEvent) => {
                              if (dragDistanceRef.current > 3) {
                                  e.preventDefault();
                              }
                          },
                      }
                    : {
                          onClick: (e: React.MouseEvent) =>
                              handleClick(e, node, false),
                      };

                // Show text when cell is large enough on screen
                const showText = screenW > 5 && screenH > 5;
                const showStats = screenW > 8;

                return (
                    <Element
                        key={node.id}
                        {...elementProps}
                        className={`absolute hover:z-10 group cursor-pointer text-left ${
                            isZoomed ? '' : 'transition-all duration-500 ease-in-out'
                        }`}
                        style={{
                            left: `${screenLeft}%`,
                            top: `${screenTop}%`,
                            width: `${screenW}%`,
                            height: `${screenH}%`,
                            backgroundColor: color,
                        }}
                    >
                        {/* Hover overlay */}
                        <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 absolute top-0 left-0 border-2 border-white/50" />

                        {/* Content */}
                        <div className="relative p-1.5 h-full w-full text-white overflow-hidden pointer-events-none">
                            {showText && (
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
                                            showStats && (
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
                                        {showStats && (
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

            {/* Zoom indicator */}
            {isZoomed && (
                <div className="absolute bottom-3 right-3 z-20 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 flex items-center gap-2 pointer-events-auto">
                    <span className="text-white font-mono">
                        {zoomLevel.toFixed(1)}x
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            resetZoom();
                        }}
                        className="text-zinc-500 hover:text-white transition-colors"
                        title="Reset zoom"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
        </div>
    );
}
