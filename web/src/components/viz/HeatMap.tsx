'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';
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
    // Tooltip & enrichment data
    volume24h?: number;
    liquidity?: number;
    endDate?: string;
    image?: string;
    volume24hrRatio?: number; // volume24h / volume — activity proxy
    eventCount?: number; // category level
    marketCount?: number; // event level
}

interface HeatMapProps {
    level: ViewLevel;
    data: Category[] | ProcessedEvent[] | MarketNode[];
    onNodeClick?: (node: HeatMapNode) => void;
    minVolume?: number;
}

// Viewport in treemap coordinate space (0–100)
interface Viewport {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_VIEWPORT: Viewport = { x0: 0, y0: 0, x1: 100, y1: 100 };
const MAX_ZOOM = 20; // viewport can shrink to 100/20 = 5 units
const ZOOM_SENSITIVITY = 0.002;

// ============================================
// Color Scales
// ============================================

const heatColorScale = (heat: number): string => {
    const h = Math.min(Math.max(heat, 0), 1);
    if (h < 0.5) {
        return d3.interpolateRgb('#22c55e', '#eab308')(h * 2);
    } else {
        return d3.interpolateRgb('#eab308', '#ef4444')((h - 0.5) * 2);
    }
};

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
                volume24h: cat.volume24h,
                eventCount: cat.eventCount,
            }));

        case 'event':
            return (data as ProcessedEvent[]).map((event) => ({
                id: event.id,
                name: event.title,
                value: event.volumeTotal,
                heat: event.volumeHeat,
                slug: event.slug,
                volume24h: event.volume24h,
                liquidity: event.liquidity,
                endDate: event.endDate,
                image: event.image,
                marketCount: event.marketCount,
            }));

        case 'market':
            return (data as MarketNode[]).map((market) => ({
                id: market.id,
                name: market.question,
                value: market.volume,
                heat: 0,
                probability: market.outcomeProb,
                slug: market.eventSlug || market.slug,
                volume24h: market.volume24hr,
                liquidity: market.liquidity,
                endDate: market.endDate,
                image: market.image,
                volume24hrRatio:
                    market.volume > 0
                        ? (market.volume24hr || 0) / market.volume
                        : 0,
            }));

        default:
            return [];
    }
}

// ============================================
// Viewport Helpers
// ============================================

function clampViewport(vp: Viewport): Viewport {
    const w = vp.x1 - vp.x0;
    const h = vp.y1 - vp.y0;
    let x0 = vp.x0;
    let y0 = vp.y0;

    // Keep viewport within 0–100 bounds
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x0 + w > 100) x0 = 100 - w;
    if (y0 + h > 100) y0 = 100 - h;

    return { x0, y0, x1: x0 + w, y1: y0 + h };
}

function getZoomLevel(vp: Viewport): number {
    return 100 / (vp.x1 - vp.x0);
}

// Check if a treemap cell overlaps the viewport
function cellInViewport(
    cellX0: number, cellY0: number, cellX1: number, cellY1: number,
    vp: Viewport
): boolean {
    return cellX1 > vp.x0 && cellX0 < vp.x1 && cellY1 > vp.y0 && cellY0 < vp.y1;
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
    // Viewport state: the visible region in treemap coordinates (0–100)
    const [viewport, setViewport] = useState<Viewport>(DEFAULT_VIEWPORT);
    const viewportRef = useRef<Viewport>(DEFAULT_VIEWPORT);

    // DOM refs
    const containerRef = useRef<HTMLDivElement>(null);

    // Drag state
    const isDraggingRef = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const vpStart = useRef<Viewport>(DEFAULT_VIEWPORT);
    const dragDistance = useRef(0);
    const [isDragging, setIsDragging] = useState(false);

    // Tooltip state
    const [tooltipNode, setTooltipNode] = useState<HeatMapNode | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
    const [tooltipStyle, setTooltipStyle] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
    const tooltipRef = useRef<HTMLDivElement>(null);

    const applyViewport = useCallback((vp: Viewport) => {
        const clamped = clampViewport(vp);
        viewportRef.current = clamped;
        setViewport(clamped);
    }, []);

    const resetZoom = useCallback(() => {
        applyViewport(DEFAULT_VIEWPORT);
    }, [applyViewport]);

    // Reset viewport when view changes
    useEffect(() => {
        resetZoom();
    }, [level, data, resetZoom]);

    // Wheel handler: zoom viewport toward cursor
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            const vp = viewportRef.current;
            const vpW = vp.x1 - vp.x0;
            const vpH = vp.y1 - vp.y0;

            // Compute zoom factor
            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const factor = Math.pow(2, delta);

            // New viewport size
            const newW = Math.min(100, Math.max(100 / MAX_ZOOM, vpW / factor));
            const newH = Math.min(100, Math.max(100 / MAX_ZOOM, vpH / factor));

            // Cursor position as fraction of the container
            const rect = el.getBoundingClientRect();
            const fracX = (e.clientX - rect.left) / rect.width;
            const fracY = (e.clientY - rect.top) / rect.height;

            // Cursor position in treemap coordinates
            const cursorTreeX = vp.x0 + fracX * vpW;
            const cursorTreeY = vp.y0 + fracY * vpH;

            // New viewport: keep cursor at the same fraction
            const newX0 = cursorTreeX - fracX * newW;
            const newY0 = cursorTreeY - fracY * newH;

            applyViewport({
                x0: newX0,
                y0: newY0,
                x1: newX0 + newW,
                y1: newY0 + newH,
            });
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [applyViewport]);

    // Mouse drag handlers for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        const vp = viewportRef.current;
        if (vp.x1 - vp.x0 >= 100) return; // Not zoomed
        if (e.button !== 0) return;
        isDraggingRef.current = true;
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY };
        vpStart.current = { ...vp };
        setIsDragging(true);
        setTooltipNode(null);
        setTooltipPos(null);
    }, []);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isDraggingRef.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            dragDistance.current = Math.sqrt(dx * dx + dy * dy);

            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const vp = vpStart.current;
            const vpW = vp.x1 - vp.x0;
            const vpH = vp.y1 - vp.y0;

            // Convert pixel drag to treemap coordinate shift (inverted: drag right → viewport moves left)
            const shiftX = -(dx / rect.width) * vpW;
            const shiftY = -(dy / rect.height) * vpH;

            applyViewport({
                x0: vp.x0 + shiftX,
                y0: vp.y0 + shiftY,
                x1: vp.x1 + shiftX,
                y1: vp.y1 + shiftY,
            });
        },
        [applyViewport]
    );

    const handleMouseUp = useCallback(() => {
        isDraggingRef.current = false;
        setIsDragging(false);
    }, []);

    // Reposition tooltip to stay within viewport
    useLayoutEffect(() => {
        if (!tooltipRef.current || !tooltipPos) return;
        const rect = tooltipRef.current.getBoundingClientRect();
        let left = tooltipPos.x + 12;
        let top = tooltipPos.y + 12;
        if (left + rect.width > window.innerWidth) {
            left = tooltipPos.x - 12 - rect.width;
        }
        if (top + rect.height > window.innerHeight) {
            top = tooltipPos.y - 12 - rect.height;
        }
        setTooltipStyle({ left, top });
    }, [tooltipPos]);

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

    // Handle node click (suppressed during drag)
    const handleClick = useCallback(
        (e: React.MouseEvent, node: HeatMapNode, isMarketLevel: boolean) => {
            if (dragDistance.current > 3) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (isMarketLevel && node.slug) {
                window.open(`https://polymarket.com/event/${node.slug}`, '_blank');
            } else if (onNodeClick) {
                e.preventDefault();
                onNodeClick(node);
            }
        },
        [onNodeClick]
    );

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
    const zoomLevel = getZoomLevel(viewport);
    const isZoomed = zoomLevel > 1.01;
    const vpW = viewport.x1 - viewport.x0;
    const vpH = viewport.y1 - viewport.y0;

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl select-none ${isZoomed
                    ? isDragging ? 'cursor-grabbing' : 'cursor-grab'
                    : ''
                }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {root.leaves().map((leaf) => {
                const node = leaf.data as HeatMapNode;

                // Skip cells outside viewport
                if (!cellInViewport(leaf.x0, leaf.y0, leaf.x1, leaf.y1, viewport)) {
                    return null;
                }

                // Map treemap coordinates to screen percentages relative to viewport
                const screenLeft = ((leaf.x0 - viewport.x0) / vpW) * 100;
                const screenTop = ((leaf.y0 - viewport.y0) / vpH) * 100;
                const screenWidth = ((leaf.x1 - leaf.x0) / vpW) * 100;
                const screenHeight = ((leaf.y1 - leaf.y0) / vpH) * 100;

                // Skip tiny cells (less than ~1% of screen)
                if (screenWidth < 1 || screenHeight < 1) return null;

                const color = getNodeColor(node);
                const showText = screenWidth > 4 && screenHeight > 4;
                const showStats = screenWidth > 6;
                const showFullProb = screenWidth > 10 && screenHeight > 8;
                const showImage = screenWidth > 12 && screenHeight > 12 && !!node.image;

                return (
                    <div
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        onClick={(e: React.MouseEvent) => {
                            if (dragDistance.current > 3) return;
                            handleClick(e, node, isMarketLevel);
                        }}
                        onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleClick(
                                    e as unknown as React.MouseEvent,
                                    node,
                                    isMarketLevel
                                );
                            }
                        }}
                        className={`absolute ${!isZoomed
                                ? 'transition-all duration-500 ease-in-out'
                                : ''
                            } hover:z-10 group cursor-pointer text-left`}
                        style={{
                            left: `${screenLeft}%`,
                            top: `${screenTop}%`,
                            width: `${screenWidth}%`,
                            height: `${screenHeight}%`,
                            backgroundColor: color,
                        }}
                        onMouseEnter={(e: React.MouseEvent) => {
                            if (!isDraggingRef.current) {
                                setTooltipNode(node);
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseMove={(e: React.MouseEvent) => {
                            if (!isDraggingRef.current) {
                                setTooltipPos({ x: e.clientX, y: e.clientY });
                            }
                        }}
                        onMouseLeave={() => {
                            setTooltipNode(null);
                            setTooltipPos(null);
                        }}
                    >
                        {/* Hover overlay */}
                        <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 absolute top-0 left-0 border-2 border-white/50 z-[1]" />

                        {/* Background image for large cells */}
                        {showImage && (
                            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={node.image}
                                    alt=""
                                    className="w-2/3 h-2/3 object-contain opacity-50 pointer-events-none"
                                    loading="lazy"
                                />
                            </div>
                        )}

                        {/* Activity badge (market level) */}
                        {showText && isMarketLevel && node.volume24hrRatio !== undefined && node.volume24hrRatio > 0.08 && (
                            <span className={`absolute top-1 right-1 z-[2] px-1 py-0.5 text-[7px] font-bold uppercase rounded text-white drop-shadow-md pointer-events-none ${node.volume24hrRatio > 0.15 ? 'bg-red-500/80' : 'bg-yellow-500/80'
                                }`}>
                                {node.volume24hrRatio > 0.15 ? 'HOT' : 'ACTIVE'}
                            </span>
                        )}

                        {/* Content — naturally sized to the cell */}
                        <div className="relative z-[2] p-1.5 h-full w-full text-white overflow-hidden pointer-events-none">
                            {showText && (
                                <div className="flex flex-col h-full">
                                    {/* Title */}
                                    <span className="font-bold text-[10px] md:text-xs leading-tight line-clamp-3 drop-shadow-md">
                                        {node.name}
                                    </span>

                                    {/* Stats at bottom */}
                                    <div className="mt-auto flex items-end justify-between gap-1">
                                        {isMarketLevel &&
                                            node.probability !== undefined ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] font-mono font-bold opacity-90 drop-shadow-md">
                                                    {Math.round(node.probability * 100)}%
                                                    <span className="text-[8px] opacity-70 ml-0.5">YES</span>
                                                </span>
                                                {showFullProb && (
                                                    <span className="text-[9px] font-mono opacity-60 drop-shadow-md">
                                                        {Math.round((1 - node.probability) * 100)}%
                                                        <span className="text-[7px] opacity-70 ml-0.5">NO</span>
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            showStats && (
                                                <span
                                                    className="text-[9px] opacity-70"
                                                    title="Activity level"
                                                >
                                                    {node.heat > 0.7
                                                        ? '\u{1F525}'
                                                        : node.heat > 0.4
                                                            ? '\u26A1'
                                                            : ''}
                                                    {node.volume24h ? ` $${d3.format('.2s')(node.volume24h)}/24h` : ''}
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
                    </div>
                );
            })}

            {/* Zoom indicator */}
            {isZoomed && (
                <div className="absolute bottom-3 left-3 z-20 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 flex items-center gap-2 pointer-events-auto">
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

            {/* Tooltip */}
            {tooltipNode && tooltipPos && (
                <div
                    ref={tooltipRef}
                    className="fixed z-50 pointer-events-none bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs"
                    style={{
                        left: tooltipStyle.left,
                        top: tooltipStyle.top,
                    }}
                >
                    {/* Image + Title */}
                    <div className="flex items-start gap-2 mb-2">
                        {tooltipNode.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={tooltipNode.image}
                                alt=""
                                className="w-8 h-8 rounded object-cover flex-shrink-0"
                            />
                        )}
                        <h4 className="text-sm font-semibold text-white line-clamp-2">
                            {tooltipNode.name}
                        </h4>
                    </div>

                    {/* Probability (market level) */}
                    {isMarketLevel && tooltipNode.probability !== undefined && (
                        <div className="mb-2">
                            <span className="text-blue-400 font-mono font-bold text-sm">
                                {Math.round(tooltipNode.probability * 100)}% YES
                            </span>
                            <span className="text-red-400 font-mono font-bold text-sm ml-2">
                                {Math.round((1 - tooltipNode.probability) * 100)}% NO
                            </span>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="space-y-1 text-xs text-zinc-400">
                        <div className="flex justify-between gap-4">
                            <span>Volume</span>
                            <span className="font-mono text-zinc-200">
                                ${d3.format('.2s')(tooltipNode.value)}
                            </span>
                        </div>
                        {tooltipNode.volume24h !== undefined && tooltipNode.volume24h > 0 && (
                            <div className="flex justify-between gap-4">
                                <span>24h Volume</span>
                                <span className="font-mono text-zinc-200">
                                    ${d3.format('.2s')(tooltipNode.volume24h)}
                                </span>
                            </div>
                        )}
                        {tooltipNode.liquidity !== undefined && tooltipNode.liquidity > 0 && (
                            <div className="flex justify-between gap-4">
                                <span>Liquidity</span>
                                <span className="font-mono text-zinc-200">
                                    ${d3.format('.2s')(tooltipNode.liquidity)}
                                </span>
                            </div>
                        )}
                        {tooltipNode.endDate && (
                            <div className="flex justify-between gap-4">
                                <span>Ends</span>
                                <span className="text-zinc-200">
                                    {new Date(tooltipNode.endDate).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                        {tooltipNode.eventCount !== undefined && (
                            <div className="flex justify-between gap-4">
                                <span>Events</span>
                                <span className="text-zinc-200">{tooltipNode.eventCount}</span>
                            </div>
                        )}
                        {tooltipNode.marketCount !== undefined && (
                            <div className="flex justify-between gap-4">
                                <span>Markets</span>
                                <span className="text-zinc-200">{tooltipNode.marketCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
