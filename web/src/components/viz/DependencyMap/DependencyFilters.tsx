'use client';

import React from 'react';
import { DependencyMapFilters, TimeWindow } from '@/lib/types';
import { SlidersHorizontal } from 'lucide-react';

interface DependencyFiltersProps {
    filters: DependencyMapFilters;
    onFiltersChange: (filters: DependencyMapFilters) => void;
    stats: {
        totalNodes: number;
        totalEdges: number;
        structuralEdges: number;
        correlationEdges: number;
    };
}

const TIME_WINDOWS: { value: TimeWindow; label: string }[] = [
    { value: '1h', label: '1H' },
    { value: '24h', label: '24H' },
    { value: '7d', label: '7D' },
];

const DEPENDENCY_TYPES: { value: DependencyMapFilters['dependencyType']; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'structural', label: 'Event' },
    { value: 'correlation', label: 'Corr' },
];

export default function DependencyFilters({
    filters,
    onFiltersChange,
    stats,
}: DependencyFiltersProps) {
    return (
        <div className="flex items-center gap-4 text-sm">
            {/* Stats */}
            <div className="flex items-center gap-2 text-zinc-500">
                <span>{stats.totalNodes} nodes</span>
                <span className="text-zinc-600">|</span>
                <span>{stats.totalEdges} edges</span>
            </div>

            <div className="h-4 w-px bg-zinc-700" />

            {/* Time Window */}
            <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">Window:</span>
                <div className="flex bg-zinc-800 rounded-md p-0.5">
                    {TIME_WINDOWS.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onFiltersChange({ ...filters, timeWindow: value })}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                filters.timeWindow === value
                                    ? 'bg-zinc-700 text-white'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dependency Type */}
            <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">Type:</span>
                <div className="flex bg-zinc-800 rounded-md p-0.5">
                    {DEPENDENCY_TYPES.map(({ value, label }) => (
                        <button
                            key={value}
                            onClick={() => onFiltersChange({ ...filters, dependencyType: value })}
                            className={`px-2 py-0.5 text-xs rounded transition-colors ${
                                filters.dependencyType === value
                                    ? 'bg-zinc-700 text-white'
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Correlation Threshold */}
            <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
                <span className="text-zinc-500 text-xs">
                    Corr &ge; {(filters.correlationThreshold * 100).toFixed(0)}%
                </span>
                <input
                    type="range"
                    min={30}
                    max={90}
                    step={10}
                    value={filters.correlationThreshold * 100}
                    onChange={(e) =>
                        onFiltersChange({
                            ...filters,
                            correlationThreshold: parseInt(e.target.value) / 100,
                        })
                    }
                    className="w-20 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
            </div>

            {/* Cross-Event Toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                    type="checkbox"
                    checked={filters.showCrossEvent}
                    onChange={(e) =>
                        onFiltersChange({ ...filters, showCrossEvent: e.target.checked })
                    }
                    className="w-3 h-3 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-0"
                />
                <span className="text-zinc-400 text-xs">Cross-event</span>
            </label>

            {/* Max Edges */}
            <div className="flex items-center gap-1">
                <span className="text-zinc-500 text-xs">Max:</span>
                <select
                    value={filters.maxEdges}
                    onChange={(e) =>
                        onFiltersChange({ ...filters, maxEdges: parseInt(e.target.value) })
                    }
                    className="bg-zinc-800 text-zinc-300 text-xs rounded px-1.5 py-0.5 border-none focus:ring-0"
                >
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                </select>
            </div>
        </div>
    );
}
