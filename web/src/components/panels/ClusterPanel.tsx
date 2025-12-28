'use client';

import React from 'react';
import { X, MapPin, ChevronRight, TrendingUp, BarChart3 } from 'lucide-react';
import * as d3 from 'd3';
import { GeoEnrichedEvent } from '@/lib/types';

interface ClusterPanelProps {
    events: GeoEnrichedEvent[];
    isOpen: boolean;
    onClose: () => void;
    onEventSelect: (eventId: string) => void;
}

// ============================================
// Heat Color Scale (matches WorldMap)
// ============================================

const heatColorScale = (heat: number): string => {
    const h = Math.min(Math.max(heat, 0), 1);
    if (h < 0.5) {
        return d3.interpolateRgb('#22c55e', '#eab308')(h * 2);
    }
    return d3.interpolateRgb('#eab308', '#ef4444')((h - 0.5) * 2);
};

// ============================================
// Event Card Component
// ============================================

interface EventCardProps {
    event: GeoEnrichedEvent;
    onClick: () => void;
}

function EventCard({ event, onClick }: EventCardProps) {
    const heatLevel =
        event.volumeHeat > 0.7
            ? { label: 'Hot', color: 'text-red-400' }
            : event.volumeHeat > 0.4
            ? { label: 'Active', color: 'text-yellow-400' }
            : { label: 'Calm', color: 'text-green-400' };

    return (
        <button
            onClick={onClick}
            className="w-full text-left p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-700/50 transition-colors group"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-zinc-200 line-clamp-2 group-hover:text-white">
                        {event.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />$
                            {d3.format('.2s')(event.volumeTotal)}
                        </span>
                        <span className="flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />
                            {event.marketCount} markets
                        </span>
                        <span className={heatLevel.color}>{heatLevel.label}</span>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 flex-shrink-0 mt-1" />
            </div>

            {/* Heat indicator bar */}
            <div className="mt-3 h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                    className="h-full transition-all"
                    style={{
                        width: `${event.volumeHeat * 100}%`,
                        backgroundColor: heatColorScale(event.volumeHeat),
                    }}
                />
            </div>
        </button>
    );
}

// ============================================
// Main Panel Component
// ============================================

export default function ClusterPanel({
    events,
    isOpen,
    onClose,
    onEventSelect,
}: ClusterPanelProps) {
    if (!isOpen || events.length === 0) return null;

    const location = events[0].geoLocation.countryName || 'Unknown Location';
    const totalVolume = events.reduce((sum, e) => sum + e.volumeTotal, 0);
    const total24hVolume = events.reduce((sum, e) => sum + e.volume24h, 0);
    const avgHeat =
        events.reduce((sum, e) => sum + e.volumeHeat, 0) / events.length;

    // Sort by volume
    const sortedEvents = [...events].sort((a, b) => b.volumeTotal - a.volumeTotal);

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-zinc-900 border-l border-zinc-800 z-50 overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 p-4 z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-zinc-400 text-sm mb-1">
                                <MapPin className="w-4 h-4" />
                                <span>{location}</span>
                            </div>
                            <h2 className="text-lg font-semibold text-white">
                                {events.length} Events
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>

                    {/* Aggregate stats */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                Total Vol
                            </div>
                            <div className="text-sm font-mono text-white">
                                ${d3.format('.2s')(totalVolume)}
                            </div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                24h Vol
                            </div>
                            <div className="text-sm font-mono text-white">
                                ${d3.format('.2s')(total24hVolume)}
                            </div>
                        </div>
                        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
                            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                                Avg Heat
                            </div>
                            <div
                                className="text-sm font-medium"
                                style={{ color: heatColorScale(avgHeat) }}
                            >
                                {Math.round(avgHeat * 100)}%
                            </div>
                        </div>
                    </div>
                </div>

                {/* Event List */}
                <div className="p-4 space-y-2">
                    {sortedEvents.map((event) => (
                        <EventCard
                            key={event.id}
                            event={event}
                            onClick={() => onEventSelect(event.id)}
                        />
                    ))}
                </div>
            </div>
        </>
    );
}
