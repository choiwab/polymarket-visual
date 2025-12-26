'use client';

import React from 'react';
import { X, ExternalLink, TrendingUp, Clock, MapPin, BarChart3 } from 'lucide-react';
import * as d3 from 'd3';
import { GeoEnrichedEvent, MarketNode } from '@/lib/types';

interface EventPanelProps {
    event: GeoEnrichedEvent | null;
    isOpen: boolean;
    onClose: () => void;
}

// ============================================
// Probability Bar Component
// ============================================

function ProbabilityBar({ market }: { market: MarketNode }) {
    const prob = market.outcomeProb;
    const yesPercent = Math.round(prob * 100);

    // Color based on probability
    const barColor =
        prob > 0.5
            ? `rgb(59, 130, 246)` // Blue for YES leaning
            : `rgb(239, 68, 68)`; // Red for NO leaning

    return (
        <a
            href={`https://polymarket.com/event/${market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-700/50 transition-colors group"
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-sm text-zinc-200 line-clamp-2 group-hover:text-white">
                    {market.question}
                </span>
                <ExternalLink className="w-4 h-4 text-zinc-500 flex-shrink-0 group-hover:text-zinc-300" />
            </div>

            <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                        className="h-full transition-all duration-300"
                        style={{
                            width: `${yesPercent}%`,
                            backgroundColor: barColor,
                        }}
                    />
                </div>
                <span className="text-xs font-mono text-zinc-400 w-10 text-right">
                    {yesPercent}%
                </span>
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                <span>NO</span>
                <span>YES</span>
            </div>

            {market.volume > 0 && (
                <div className="mt-2 text-[10px] text-zinc-500">
                    Vol: ${d3.format('.2s')(market.volume)}
                </div>
            )}
        </a>
    );
}

// ============================================
// Multi-Choice Market Component
// ============================================

function MultiChoiceMarket({ market }: { market: MarketNode }) {
    if (!market.outcomes || !market.outcomePrices) return null;

    // Sort outcomes by probability
    const sortedOutcomes = market.outcomes
        .map((outcome, i) => ({
            name: outcome,
            prob: market.outcomePrices![i] || 0,
        }))
        .sort((a, b) => b.prob - a.prob);

    return (
        <a
            href={`https://polymarket.com/event/${market.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-700/50 transition-colors group"
        >
            <div className="flex items-start justify-between gap-2 mb-3">
                <span className="text-sm text-zinc-200 line-clamp-2 group-hover:text-white">
                    {market.question}
                </span>
                <ExternalLink className="w-4 h-4 text-zinc-500 flex-shrink-0 group-hover:text-zinc-300" />
            </div>

            <div className="space-y-1.5">
                {sortedOutcomes.slice(0, 4).map((outcome, i) => {
                    const percent = Math.round(outcome.prob * 100);
                    // Color gradient based on probability
                    const color = d3.interpolateRgb(
                        'rgb(239, 68, 68)',
                        'rgb(59, 130, 246)'
                    )(outcome.prob);

                    return (
                        <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full"
                                    style={{
                                        width: `${percent}%`,
                                        backgroundColor: color,
                                    }}
                                />
                            </div>
                            <span className="text-[10px] text-zinc-400 w-20 truncate">
                                {outcome.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
                                {percent}%
                            </span>
                        </div>
                    );
                })}
                {sortedOutcomes.length > 4 && (
                    <div className="text-[10px] text-zinc-500">
                        +{sortedOutcomes.length - 4} more options
                    </div>
                )}
            </div>

            {market.volume > 0 && (
                <div className="mt-2 text-[10px] text-zinc-500">
                    Vol: ${d3.format('.2s')(market.volume)}
                </div>
            )}
        </a>
    );
}

// ============================================
// Main Panel Component
// ============================================

export default function EventPanel({ event, isOpen, onClose }: EventPanelProps) {
    if (!isOpen || !event) return null;

    const sortedMarkets = [...event.markets].sort((a, b) => b.volume - a.volume);
    const topMarkets = sortedMarkets.slice(0, 5);

    // Heat indicator
    const heatLevel =
        event.volumeHeat > 0.7
            ? { label: 'Hot', color: 'text-red-400' }
            : event.volumeHeat > 0.4
            ? { label: 'Active', color: 'text-yellow-400' }
            : { label: 'Calm', color: 'text-green-400' };

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
                        <h2 className="text-lg font-semibold text-white line-clamp-2">
                            {event.title}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-zinc-700 transition-colors flex-shrink-0"
                        >
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                                <TrendingUp className="w-3 h-3" />
                                Total Volume
                            </div>
                            <div className="text-lg font-mono text-white">
                                ${d3.format('.2s')(event.volumeTotal)}
                            </div>
                        </div>

                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                                <Clock className="w-3 h-3" />
                                24h Volume
                            </div>
                            <div className="text-lg font-mono text-white">
                                ${d3.format('.2s')(event.volume24h)}
                            </div>
                        </div>

                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                                <BarChart3 className="w-3 h-3" />
                                Activity
                            </div>
                            <div className={`text-lg font-medium ${heatLevel.color}`}>
                                {heatLevel.label}
                            </div>
                        </div>

                        <div className="bg-zinc-800/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
                                <BarChart3 className="w-3 h-3" />
                                Markets
                            </div>
                            <div className="text-lg font-mono text-white">
                                {event.marketCount}
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    {event.geoLocation.countryName && (
                        <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/30 rounded-lg p-3">
                            <MapPin className="w-4 h-4" />
                            <span>{event.geoLocation.countryName}</span>
                            <span className="text-zinc-600 text-xs">
                                ({Math.round(event.geoLocation.confidence * 100)}%
                                confidence)
                            </span>
                        </div>
                    )}

                    {/* Description */}
                    {event.description && (
                        <div>
                            <h3 className="text-sm font-medium text-zinc-400 mb-2">
                                Description
                            </h3>
                            <p className="text-sm text-zinc-300 line-clamp-4">
                                {event.description}
                            </p>
                        </div>
                    )}

                    {/* Markets */}
                    <div>
                        <h3 className="text-sm font-medium text-zinc-400 mb-3">
                            Top Markets ({event.marketCount} total)
                        </h3>
                        <div className="space-y-2">
                            {topMarkets.map((market) =>
                                market.isMultiChoice ? (
                                    <MultiChoiceMarket
                                        key={market.id}
                                        market={market}
                                    />
                                ) : (
                                    <ProbabilityBar
                                        key={market.id}
                                        market={market}
                                    />
                                )
                            )}
                        </div>
                    </div>

                    {/* View All Link */}
                    <a
                        href={`https://polymarket.com/event/${event.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white text-center rounded-lg font-medium transition-colors"
                    >
                        View on Polymarket
                        <ExternalLink className="w-4 h-4 inline-block ml-2" />
                    </a>
                </div>
            </div>
        </>
    );
}
