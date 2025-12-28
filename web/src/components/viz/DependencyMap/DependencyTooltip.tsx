'use client';

import React from 'react';
import { DependencyEdge } from '@/lib/types';

interface DependencyTooltipProps {
    edge: DependencyEdge | null;
    position: { x: number; y: number } | null;
}

// Type badge colors and labels
const TYPE_CONFIG = {
    structural: { bg: 'bg-zinc-700', text: 'text-zinc-300', label: 'Same Event' },
    correlation: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Correlation' },
    entity: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Shared Entity' },
    temporal: { bg: 'bg-purple-900/50', text: 'text-purple-400', label: 'Time Link' },
};

// Strength bar colors
const STRENGTH_COLORS = {
    structural: 'bg-zinc-500',
    correlation: 'bg-green-500',
    entity: 'bg-blue-500',
    temporal: 'bg-purple-500',
};

export default function DependencyTooltip({ edge, position }: DependencyTooltipProps) {
    if (!edge || !position) return null;

    const isPositive = edge.correlation !== undefined && edge.correlation > 0;
    const isNegative = edge.correlation !== undefined && edge.correlation < 0;

    // Get type config with fallback
    const typeConfig = TYPE_CONFIG[edge.type] || TYPE_CONFIG.structural;
    const strengthColor = STRENGTH_COLORS[edge.type] || STRENGTH_COLORS.structural;

    // For correlation, adjust color based on direction
    const adjustedTypeConfig =
        edge.type === 'correlation' && isNegative
            ? { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Correlation' }
            : typeConfig;

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
                    className={`px-1.5 py-0.5 text-xs font-medium rounded ${adjustedTypeConfig.bg} ${adjustedTypeConfig.text}`}
                >
                    {adjustedTypeConfig.label}
                </span>

                {edge.timeWindow && (
                    <span className="text-xs text-zinc-500">{edge.timeWindow}</span>
                )}
            </div>

            {/* Correlation Value */}
            {edge.type === 'correlation' && edge.correlation !== undefined && (
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

            {/* Shared Entities */}
            {edge.type === 'entity' && edge.sharedEntities && edge.sharedEntities.length > 0 && (
                <div className="mb-2">
                    <span className="text-zinc-400 text-xs">Shared: </span>
                    <span className="text-blue-300 text-xs font-medium">
                        {edge.sharedEntities.join(', ')}
                    </span>
                </div>
            )}

            {/* Temporal Info */}
            {edge.type === 'temporal' && edge.daysDiff !== undefined && (
                <div className="mb-2">
                    <span className="text-zinc-400 text-xs">Timing: </span>
                    <span className="text-purple-300 text-xs font-medium">
                        {edge.daysDiff < 1
                            ? 'Same day'
                            : edge.precedence === 'before'
                            ? `${Math.round(edge.daysDiff)} days earlier`
                            : edge.precedence === 'after'
                            ? `${Math.round(edge.daysDiff)} days later`
                            : `${Math.round(edge.daysDiff)} days apart`}
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
                                edge.type === 'correlation' && isNegative
                                    ? 'bg-red-500'
                                    : strengthColor
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
