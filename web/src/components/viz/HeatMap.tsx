'use client';

import React, { useMemo, useState, useRef, useCallback, useEffect } from 'react';
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

// ============================================
// Constants
// ============================================

const MIN_ZOOM = 1;
const MAX_ZOOM = 20;
const ZOOM_SENSITIVITY = 0.002;

// ============================================
// Color Scales
// ============================================

// Heat color scale: Green (cold/low activity) → Yellow → Red (hot/high activity)
const heatColorScale = (heat: number): string => {
    const h = Math.min(Math.max(heat, 0), 1);
    if (h < 0.5) {
        return d3.interpolateRgb('#22c55e', '#eab308')(h * 2);
    } else {
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
                heat: 0,
                probability: market.outcomeProb,
                slug: market.slug,
            }));

        default:
            return [];
    }
}

// ============================================
// Zoom Helpers
// ============================================

function clampPan(
    px: number,
    py: number,
    z: number,
    viewW: number,
    viewH: number
): { x: number; y: number } {
    // At zoom z, content is viewW*z x viewH*z pixels.
    // Pan is in pre-scale coordinates: screen = (content + pan) * z.
    // Right edge of content at screen: (viewW + pan.x) * z must be >= viewW
    //   => pan.x >= viewW/z - viewW
    // Left edge: pan.x * z <= 0 => pan.x <= 0
    const minPx = viewW / z - viewW;
    const minPy = viewH / z - viewH;
    return {
        x: Math.min(0, Math.max(minPx, px)),
        y: Math.min(0, Math.max(minPy, py)),
    };
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
    // Zoom state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const zoomRef = useRef(1);
    const panRef = useRef({ x: 0, y: 0 });

    // DOM refs
    const containerRef = useRef<HTMLDivElement>(null);

    // Drag state
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const panStart = useRef({ x: 0, y: 0 });
    const dragDistance = useRef(0);

    const applyTransform = useCallback(
        (newZoom: number, newPan: { x: number; y: number }) => {
            zoomRef.current = newZoom;
            panRef.current = newPan;
            setZoom(newZoom);
            setPan(newPan);
        },
        []
    );

    const resetZoom = useCallback(() => {
        applyTransform(1, { x: 0, y: 0 });
    }, [applyTransform]);

    // Reset zoom when view changes
    useEffect(() => {
        resetZoom();
    }, [level, data, resetZoom]);

    // Wheel handler for zoom-toward-cursor
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();

            const oldZoom = zoomRef.current;
            const oldPan = panRef.current;

            const delta = -e.deltaY * ZOOM_SENSITIVITY;
            const factor = Math.pow(2, delta);
            const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * factor));

            // Cursor position relative to the container
            const rect = el.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            // Keep the point under cursor fixed:
            // screen = (content + pan) * zoom
            // content = screen / zoom - pan
            // New pan so same content point maps to same screen point:
            // newPan = screen / newZoom - content = screen / newZoom - (screen / oldZoom - oldPan)
            const newPanX = cursorX / newZoom - cursorX / oldZoom + oldPan.x;
            const newPanY = cursorY / newZoom - cursorY / oldZoom + oldPan.y;

            const clamped = clampPan(newPanX, newPanY, newZoom, rect.width, rect.height);
            applyTransform(newZoom, clamped);
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => el.removeEventListener('wheel', handleWheel);
    }, [applyTransform]);

    // Mouse drag handlers for panning
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (zoomRef.current <= 1) return;
        if (e.button !== 0) return;
        isDragging.current = true;
        dragDistance.current = 0;
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...panRef.current };
    }, []);

    const handleMouseMove = useCallback(
        (e: React.MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            dragDistance.current = Math.sqrt(dx * dx + dy * dy);

            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const newPan = clampPan(
                panStart.current.x + dx / zoomRef.current,
                panStart.current.y + dy / zoomRef.current,
                zoomRef.current,
                rect.width,
                rect.height
            );
            applyTransform(zoomRef.current, newPan);
        },
        [applyTransform]
    );

    const handleMouseUp = useCallback(() => {
        isDragging.current = false;
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
    const isZoomed = zoom > 1;

    return (
        <div
            ref={containerRef}
            className={`relative w-full h-full overflow-hidden bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl select-none ${
                isZoomed ? (isDragging.current ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Transform container for zoom/pan */}
            <div
                style={{
                    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                    transformOrigin: '0 0',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                }}
            >
                {root.leaves().map((leaf) => {
                    const node = leaf.data as HeatMapNode;
                    const width = leaf.x1 - leaf.x0;
                    const height = leaf.y1 - leaf.y0;

                    // Zoom-aware visibility: effective visual size
                    const effectiveWidth = width * zoom;
                    const effectiveHeight = height * zoom;

                    if (effectiveWidth < 2 || effectiveHeight < 2) return null;

                    const color = getNodeColor(node);
                    const showText = effectiveWidth > 5 && effectiveHeight > 5;
                    const showStats = effectiveWidth > 8;

                    const Element = isMarketLevel ? 'a' : 'button';

                    const elementProps = isMarketLevel
                        ? {
                              href: `https://polymarket.com/event/${node.slug}`,
                              target: '_blank' as const,
                              rel: 'noopener noreferrer',
                              onClick: (e: React.MouseEvent) => {
                                  if (dragDistance.current > 3) {
                                      e.preventDefault();
                                      e.stopPropagation();
                                  }
                              },
                          }
                        : {
                              onClick: (e: React.MouseEvent) =>
                                  handleClick(e, node, false),
                          };

                    return (
                        <Element
                            key={node.id}
                            {...elementProps}
                            className={`absolute ${
                                !isZoomed
                                    ? 'transition-all duration-500 ease-in-out'
                                    : ''
                            } hover:z-10 group cursor-pointer text-left`}
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

                            {/* Content with counter-scaling */}
                            {showText && (
                                <div
                                    className="relative text-white overflow-hidden pointer-events-none"
                                    style={{
                                        transform: `scale(${1 / zoom})`,
                                        transformOrigin: 'top left',
                                        width: `${zoom * 100}%`,
                                        height: `${zoom * 100}%`,
                                        padding: `${6 * zoom}px`,
                                    }}
                                >
                                    <div className="flex flex-col h-full">
                                        {/* Title */}
                                        <span className="font-bold text-[10px] md:text-xs leading-tight line-clamp-3 drop-shadow-md">
                                            {node.name}
                                        </span>

                                        {/* Stats at bottom */}
                                        <div className="mt-auto flex items-end justify-between gap-1">
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
                                                            ? '\u{1F525}'
                                                            : node.heat > 0.4
                                                            ? '\u26A1'
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
                                </div>
                            )}
                        </Element>
                    );
                })}
            </div>

            {/* Zoom indicator */}
            {isZoomed && (
                <div className="absolute bottom-3 left-3 z-20 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 flex items-center gap-2 pointer-events-auto">
                    <span className="text-white font-mono">
                        {zoom.toFixed(1)}x
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
