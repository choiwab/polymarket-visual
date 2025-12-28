'use client';

import React from 'react';
import { DependencyEdge } from '@/lib/types';

interface DependencyTooltipProps {
    edge: DependencyEdge | null;
    position: { x: number; y: number } | null;
}

export default function DependencyTooltip({ edge, position }: DependencyTooltipProps) {
    if (!edge || !position) return null;

    const isPositive = edge.correlation !== undefined && edge.correlation > 0;
    const isNegative = edge.correlation !== undefined && edge.correlation < 0;

    return (
        <div
            className="fixed z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs pointer-events-none"
            style={{
                left: position.x + 10,
                top: position.y + 10,
            }}
        >
            {/* Dependency Type */}
            <div className="flex items-center gap-2 mb-2">
                <span
                    className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                        edge.type === 'structural'
                            ? 'bg-zinc-700 text-zinc-300'
                            : isPositive
                            ? 'bg-green-900/50 text-green-400'
                            : 'bg-red-900/50 text-red-400'
                    }`}
                >
                    {edge.type === 'structural' ? 'Structural' : 'Correlation'}
                </span>

                {edge.timeWindow && (
                    <span className="text-xs text-zinc-500">{edge.timeWindow}</span>
                )}
            </div>

            {/* Correlation Value */}
            {edge.correlation !== undefined && (
                <div className="mb-2">
                    <span className="text-zinc-400 text-xs">Correlation: </span>
                    <span
                        className={`font-mono font-bold ${
                            isPositive ? 'text-green-400' : 'text-red-400'
                        }`}
                    >
                        {edge.correlation > 0 ? '+' : ''}
                        {(edge.correlation * 100).toFixed(1)}%
                    </span>
                </div>
            )}

            {/* Shared Event */}
            {edge.sharedEventTitle && (
                <div className="mb-2">
                    <span className="text-zinc-400 text-xs">Shared Event: </span>
                    <span className="text-zinc-200 text-xs">{edge.sharedEventTitle}</span>
                </div>
            )}

            {/* Explanation */}
            {edge.explanation && (
                <p className="text-xs text-zinc-400 leading-relaxed">{edge.explanation}</p>
            )}

            {/* Weight indicator */}
            <div className="mt-2 pt-2 border-t border-zinc-700">
                <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-xs">Strength:</span>
                    <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full ${
                                edge.type === 'structural'
                                    ? 'bg-zinc-500'
                                    : isPositive
                                    ? 'bg-green-500'
                                    : 'bg-red-500'
                            }`}
                            style={{ width: `${edge.weight * 100}%` }}
                        />
                    </div>
                    <span className="text-zinc-400 text-xs font-mono">
                        {(edge.weight * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        </div>
    );
}
