'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { ProcessedEvent, MarketNode } from '@/lib/types';
import * as d3 from 'd3';

interface MarketSelectorProps {
    events: ProcessedEvent[];
    selectedMarketId: string | null;
    onMarketSelect: (marketId: string | null) => void;
}

interface FlatMarket extends MarketNode {
    eventTitle: string;
    categoryId: string;
}

export default function MarketSelector({
    events,
    selectedMarketId,
    onMarketSelect,
}: MarketSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Flatten markets from all events
    const allMarkets = useMemo((): FlatMarket[] => {
        const markets: FlatMarket[] = [];
        for (const event of events) {
            for (const market of event.markets) {
                markets.push({
                    ...market,
                    eventId: event.id,
                    eventTitle: event.title,
                    categoryId: event.categoryId,
                });
            }
        }
        // Sort by volume
        return markets.sort((a, b) => b.volume - a.volume);
    }, [events]);

    // Find selected market
    const selectedMarket = useMemo(() => {
        if (!selectedMarketId) return null;
        return allMarkets.find((m) => m.id === selectedMarketId) || null;
    }, [selectedMarketId, allMarkets]);

    // Filter markets by search query
    const filteredMarkets = useMemo(() => {
        if (!searchQuery.trim()) {
            return allMarkets.slice(0, 20); // Show top 20 by volume
        }

        const query = searchQuery.toLowerCase();
        return allMarkets
            .filter(
                (m) =>
                    m.question.toLowerCase().includes(query) ||
                    m.eventTitle.toLowerCase().includes(query)
            )
            .slice(0, 20);
    }, [allMarkets, searchQuery]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when dropdown opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (market: FlatMarket) => {
        onMarketSelect(market.id);
        setIsOpen(false);
        setSearchQuery('');
    };

    const handleClear = () => {
        onMarketSelect(null);
        setSearchQuery('');
    };

    return (
        <div ref={dropdownRef} className="relative">
            {/* Selected Market or Search Button */}
            {selectedMarket ? (
                <div className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 max-w-md">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{selectedMarket.question}</p>
                        <p className="text-xs text-zinc-500 truncate">
                            {selectedMarket.eventTitle} | ${d3.format('.2s')(selectedMarket.volume)}
                        </p>
                    </div>
                    <button
                        onClick={handleClear}
                        className="p-1 text-zinc-400 hover:text-white transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                >
                    <Search className="w-4 h-4" />
                    <span className="text-sm">Select a market...</span>
                </button>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-96 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    {/* Search Input */}
                    <div className="p-2 border-b border-zinc-700">
                        <div className="flex items-center gap-2 bg-zinc-900 rounded-md px-3 py-2">
                            <Search className="w-4 h-4 text-zinc-500" />
                            <input
                                ref={inputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search markets..."
                                className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 focus:outline-none"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-zinc-500 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Market List */}
                    <div className="max-h-80 overflow-y-auto">
                        {filteredMarkets.length === 0 ? (
                            <div className="p-4 text-center text-zinc-500 text-sm">
                                No markets found
                            </div>
                        ) : (
                            filteredMarkets.map((market) => (
                                <button
                                    key={market.id}
                                    onClick={() => handleSelect(market)}
                                    className={`w-full text-left px-3 py-2 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-b-0 ${
                                        market.id === selectedMarketId ? 'bg-zinc-700' : ''
                                    }`}
                                >
                                    <p className="text-sm text-white truncate">{market.question}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-zinc-500 truncate flex-1">
                                            {market.eventTitle}
                                        </span>
                                        <span className="text-xs text-zinc-400 font-mono">
                                            ${d3.format('.2s')(market.volume)}
                                        </span>
                                        <span
                                            className={`text-xs font-mono ${
                                                market.outcomeProb > 0.5
                                                    ? 'text-blue-400'
                                                    : 'text-red-400'
                                            }`}
                                        >
                                            {Math.round(market.outcomeProb * 100)}%
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer hint */}
                    <div className="p-2 border-t border-zinc-700 bg-zinc-900/50">
                        <p className="text-xs text-zinc-500 text-center">
                            Showing top {filteredMarkets.length} markets by volume
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
