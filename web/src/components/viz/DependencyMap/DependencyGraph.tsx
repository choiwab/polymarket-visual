'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { DependencyGraph, DependencyNode, DependencyEdge } from '@/lib/types';

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
    const simulationRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null);
    const [nodes, setNodes] = useState<SimNode[]>([]);
    const [links, setLinks] = useState<SimLink[]>([]);

    // Volume to radius scale
    const radiusScale = useCallback((volume: number) => {
        const minRadius = 20;
        const maxRadius = 50;
        const maxVolume = Math.max(...graph.nodes.map(n => n.volume), 1);
        const normalized = Math.sqrt(volume / maxVolume);
        return minRadius + normalized * (maxRadius - minRadius);
    }, [graph.nodes]);

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

    // Handle node drag
    const handleDragStart = useCallback((event: React.MouseEvent, node: SimNode) => {
        if (!simulationRef.current) return;
        simulationRef.current.alphaTarget(0.3).restart();
        node.fx = node.x;
        node.fy = node.y;
    }, []);

    const handleDrag = useCallback((event: React.MouseEvent, node: SimNode) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        node.fx = event.clientX - rect.left;
        node.fy = event.clientY - rect.top;
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

    if (!graph.nodes.length) {
        return (
            <div className="flex items-center justify-center h-full w-full text-zinc-500">
                Select a market to view dependencies
            </div>
        );
    }

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className="bg-zinc-900"
        >
            {/* Edge lines */}
            <g className="edges">
                {links.map((link) => {
                    const strokeWidth = 1 + link.edge.weight * 5;
                    const opacity = 0.4 + link.edge.weight * 0.6;
                    // Different dash patterns for different edge types
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

                    return (
                        <g
                            key={node.id}
                            transform={`translate(${node.x}, ${node.y})`}
                            className="cursor-pointer"
                            onClick={() => onNodeClick?.(node)}
                            onMouseDown={(e) => handleDragStart(e, node)}
                            onMouseMove={(e) => {
                                if (e.buttons === 1) handleDrag(e, node);
                            }}
                            onMouseUp={() => handleDragEnd(node)}
                        >
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

                            {/* Label */}
                            <text
                                y={radius + 16}
                                textAnchor="middle"
                                className="text-xs fill-zinc-300 pointer-events-none"
                                style={{ fontSize: '10px' }}
                            >
                                {truncateText(node.question, 25)}
                            </text>

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
        </svg>
    );
}

function truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
}
