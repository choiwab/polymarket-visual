'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { DependencyGraph, DependencyNode, DependencyEdge } from '@/lib/types';
import { RotateCcw } from 'lucide-react';

// ============================================
// Types
// ============================================

interface DependencyGraphProps {
    graph: DependencyGraph;
    width: number;
    height: number;
    onNodeClick?: (node: DependencyNode) => void;
    onEdgeHover?: (edge: DependencyEdge | null, event?: React.MouseEvent) => void;
}

interface SimNode extends DependencyNode {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

interface SimLink {
    source: SimNode;
    target: SimNode;
    edge: DependencyEdge;
}

// ============================================
// Color Scales
// ============================================

const CATEGORY_COLORS: Record<string, string> = {
    'politics': '#ef4444', // red
    'crypto': '#f97316', // orange
    'sports': '#22c55e', // green
    'pop-culture': '#a855f7', // purple
    'business': '#3b82f6', // blue
    'science': '#06b6d4', // cyan
    'world': '#eab308', // yellow
    'other': '#71717a', // gray
};

function getCategoryColor(categoryId: string): string {
    return CATEGORY_COLORS[categoryId] || CATEGORY_COLORS['other'];
}

function getEdgeColor(edge: DependencyEdge): string {
    switch (edge.type) {
        case 'structural':
            return '#71717a'; // Gray for structural
        case 'correlation':
            // Green for positive, red for negative correlation
            return edge.correlation !== undefined && edge.correlation > 0 ? '#22c55e' : '#ef4444';
        case 'entity':
            return '#3b82f6'; // Blue for shared entities
        case 'temporal':
            return '#a855f7'; // Purple for temporal proximity
        default:
            return '#71717a';
    }
}

// ============================================
// Component
// ============================================

export default function DependencyGraphViz({
    graph,
    width,
    height,
    onNodeClick,
    onEdgeHover,
}: DependencyGraphProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
    const [nodes, setNodes] = useState<SimNode[]>([]);
    const [links, setLinks] = useState<SimLink[]>([]);
    const [zoomScale, setZoomScale] = useState(1);

    // Drag-vs-click tracking
    const dragDistanceRef = useRef(0);
    const dragStartPos = useRef({ x: 0, y: 0 });

    // Volume to radius scale
    const radiusScale = useCallback((volume: number) => {
        const minRadius = 20;
        const maxRadius = 50;
        const maxVolume = Math.max(...graph.nodes.map(n => n.volume), 1);
        const normalized = Math.sqrt(volume / maxVolume);
        return minRadius + normalized * (maxRadius - minRadius);
    }, [graph.nodes]);

    // Setup d3.zoom
    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.2, 10])
            .on('zoom', (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => {
                transformRef.current = event.transform;
                setZoomScale(event.transform.k);
                if (gRef.current) {
                    gRef.current.setAttribute(
                        'transform',
                        event.transform.toString()
                    );
                }
            });

        // Filter: only zoom on wheel or background drag (not on node drag)
        zoom.filter((event: Event) => {
            // Always allow wheel events
            if (event.type === 'wheel') return true;
            // For mouse events, only allow if not on a node (check if target is the SVG or the background rect)
            const target = event.target as Element;
            if (event.type === 'mousedown') {
                return target.tagName === 'svg' || target.classList.contains('zoom-bg');
            }
            return true;
        });

        svg.call(zoom);
        zoomRef.current = zoom;

        return () => {
            svg.on('.zoom', null);
        };
    }, []);

    // Reset zoom when graph changes
    useEffect(() => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.call(zoomRef.current.transform, d3.zoomIdentity);
    }, [graph]);

    // Initialize simulation
    useEffect(() => {
        if (!graph.nodes.length) return;

        // Create simulation nodes
        const simNodes: SimNode[] = graph.nodes.map((node) => ({
            ...node,
            x: width / 2 + (Math.random() - 0.5) * 100,
            y: height / 2 + (Math.random() - 0.5) * 100,
            vx: 0,
            vy: 0,
        }));

        // Find center node and fix it
        const centerNode = simNodes.find(n => n.id === graph.centerNodeId);
        if (centerNode) {
            centerNode.fx = width / 2;
            centerNode.fy = height / 2;
        }

        // Create simulation links
        const simLinks: SimLink[] = graph.edges.map((edge) => ({
            source: simNodes.find(n => n.id === edge.sourceId)!,
            target: simNodes.find(n => n.id === edge.targetId)!,
            edge,
        })).filter(link => link.source && link.target);

        // Create force simulation
        const simulation = d3.forceSimulation<SimNode>(simNodes)
            .force('link', d3.forceLink<SimNode, SimLink>(simLinks)
                .id(d => d.id)
                .distance(150)
                .strength(d => d.edge.weight * 0.5)
            )
            .force('charge', d3.forceManyBody<SimNode>()
                .strength(-300)
            )
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide<SimNode>()
                .radius(d => radiusScale(d.volume) + 10)
            )
            .alphaDecay(0.05)
            .velocityDecay(0.4);

        // Update state on each tick
        simulation.on('tick', () => {
            setNodes([...simNodes]);
            setLinks([...simLinks]);
        });

        simulationRef.current = simulation;

        return () => {
            simulation.stop();
        };
    }, [graph, width, height, radiusScale]);

    // Handle node drag — inverse-transform mouse coords to simulation space
    const handleDragStart = useCallback((event: React.MouseEvent, node: SimNode) => {
        if (!simulationRef.current) return;
        dragDistanceRef.current = 0;
        dragStartPos.current = { x: event.clientX, y: event.clientY };
        simulationRef.current.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
    }, []);

    const handleDrag = useCallback((event: React.MouseEvent, node: SimNode) => {
        if (!svgRef.current) return;
        const dx = event.clientX - dragStartPos.current.x;
        const dy = event.clientY - dragStartPos.current.y;
        dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        const rect = svgRef.current.getBoundingClientRect();
        const t = transformRef.current;
        // Inverse-transform: simulation coords = (screen coords - translate) / scale
        node.fx = (event.clientX - rect.left - t.x) / t.k;
        node.fy = (event.clientY - rect.top - t.y) / t.k;
    }, []);

    const handleDragEnd = useCallback((node: SimNode) => {
        if (!simulationRef.current) return;
        simulationRef.current.alphaTarget(0);
        // Keep center node fixed
        if (node.id !== graph.centerNodeId) {
            node.fx = null;
            node.fy = null;
        }
    }, [graph.centerNodeId]);

    const handleNodeClick = useCallback((event: React.MouseEvent, node: SimNode) => {
        // Only trigger click if user didn't drag
        if (dragDistanceRef.current > 5) return;
        onNodeClick?.(node);
    }, [onNodeClick]);

    const resetZoom = useCallback(() => {
        if (!svgRef.current || !zoomRef.current) return;
        const svg = d3.select(svgRef.current);
        svg.transition().duration(300).call(
            zoomRef.current.transform,
            d3.zoomIdentity
        );
    }, []);

    if (!graph.nodes.length) {
        return (
            <div className="flex items-center justify-center h-full w-full text-zinc-500">
                Select a market to view dependencies
            </div>
        );
    }

    const isZoomed = Math.abs(zoomScale - 1) > 0.01;

    return (
        <div className="relative w-full h-full">
            <svg
                ref={svgRef}
                width={width}
                height={height}
                className="bg-zinc-900"
            >
                {/* Invisible background rect for pan detection */}
                <rect
                    width={width}
                    height={height}
                    fill="transparent"
                    className="zoom-bg"
                />

                {/* Zoomable group */}
                <g ref={gRef}>
                    {/* Edge lines */}
                    <g className="edges">
                        {links.map((link) => {
                            const strokeWidth = 1 + link.edge.weight * 5;
                            const opacity = 0.4 + link.edge.weight * 0.6;
                            const strokeDasharray =
                                link.edge.type === 'structural' ? '4,4' :
                                link.edge.type === 'temporal' ? '8,4' :
                                'none';

                            return (
                                <line
                                    key={link.edge.id}
                                    x1={link.source.x}
                                    y1={link.source.y}
                                    x2={link.target.x}
                                    y2={link.target.y}
                                    stroke={getEdgeColor(link.edge)}
                                    strokeWidth={strokeWidth}
                                    strokeOpacity={opacity}
                                    strokeDasharray={strokeDasharray}
                                    className="cursor-pointer transition-opacity hover:opacity-100"
                                    onMouseEnter={(e) => onEdgeHover?.(link.edge, e)}
                                    onMouseLeave={() => onEdgeHover?.(null)}
                                />
                            );
                        })}
                    </g>

                    {/* Nodes */}
                    <g className="nodes">
                        {nodes.map((node) => {
                            const radius = radiusScale(node.volume);
                            const isCenter = node.id === graph.centerNodeId;
                            const categoryColor = getCategoryColor(node.categoryId);
                            const glowIntensity = (node.volatility || 0) * 15;
                            // Show more text when zoomed in
                            const labelMaxLen = Math.round(25 + (zoomScale - 1) * 30);

                            return (
                                <g
                                    key={node.id}
                                    transform={`translate(${node.x}, ${node.y})`}
                                    className="cursor-pointer"
                                    onClick={(e) => handleNodeClick(e, node)}
                                    onMouseDown={(e) => handleDragStart(e, node)}
                                    onMouseMove={(e) => {
                                        if (e.buttons === 1) handleDrag(e, node);
                                    }}
                                    onMouseUp={() => handleDragEnd(node)}
                                >
                                    {/* Native SVG tooltip — full title on hover */}
                                    <title>{node.question}</title>

                                    {/* Glow effect for volatility */}
                                    {glowIntensity > 0 && (
                                        <circle
                                            r={radius + 5}
                                            fill="none"
                                            stroke={categoryColor}
                                            strokeWidth={2}
                                            opacity={0.3}
                                            style={{
                                                filter: `blur(${glowIntensity}px)`,
                                            }}
                                        />
                                    )}

                                    {/* Main circle */}
                                    <circle
                                        r={radius}
                                        fill={categoryColor}
                                        stroke={isCenter ? '#fff' : '#27272a'}
                                        strokeWidth={isCenter ? 3 : 2}
                                        className="transition-all duration-200 hover:brightness-110"
                                    />

                                    {/* Center indicator */}
                                    {isCenter && (
                                        <circle
                                            r={radius + 8}
                                            fill="none"
                                            stroke="#fff"
                                            strokeWidth={1}
                                            strokeDasharray="4,4"
                                            opacity={0.5}
                                        />
                                    )}

                                    {/* Label — counter-scale so text stays readable at any zoom */}
                                    <g transform={`scale(${1 / zoomScale})`}>
                                        <text
                                            y={radius * zoomScale + 16}
                                            textAnchor="middle"
                                            className="fill-zinc-300 pointer-events-none"
                                            style={{ fontSize: '11px' }}
                                        >
                                            {truncateText(node.question, labelMaxLen)}
                                        </text>
                                    </g>

                                    {/* Probability badge */}
                                    <text
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        className="font-bold fill-white pointer-events-none"
                                        style={{ fontSize: `${Math.max(10, radius / 3)}px` }}
                                    >
                                        {Math.round(node.outcomeProb * 100)}%
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                </g>
            </svg>

            {/* Zoom indicator */}
            {isZoomed && (
                <div className="absolute bottom-3 right-3 z-20 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-400 flex items-center gap-2">
                    <span className="text-white font-mono">
                        {zoomScale.toFixed(1)}x
                    </span>
                    <button
                        onClick={resetZoom}
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

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
