'use client';

import React, { useState, useMemo } from 'react';
import HeatMap from '@/components/viz/HeatMap';
import Breadcrumb from '@/components/nav/Breadcrumb';
import { useEventData } from '@/hooks/useEventData';
import { ViewState, ViewLevel, Category, ProcessedEvent, MarketNode } from '@/lib/types';
import { Settings2, ArrowLeft, Loader2 } from 'lucide-react';

export default function Home() {
    const [minVolume, setMinVolume] = useState(100000);
    const [viewState, setViewState] = useState<ViewState>({
        level: 'category',
    });

    const { categories, getEventsForCategory, getEventById, isLoading } = useEventData();

    // Get the current data based on view level
    const currentData = useMemo((): Category[] | ProcessedEvent[] | MarketNode[] => {
        switch (viewState.level) {
            case 'category':
                return categories;
            case 'event':
                if (viewState.selectedCategoryId) {
                    return getEventsForCategory(viewState.selectedCategoryId);
                }
                return [];
            case 'market':
                if (viewState.selectedEventId) {
                    const event = getEventById(viewState.selectedEventId);
                    return event?.markets || [];
                }
                return [];
            default:
                return [];
        }
    }, [viewState, categories, getEventsForCategory, getEventById]);

    // Handle node click for navigation
    const handleNodeClick = (node: { id: string; name: string }) => {
        if (viewState.level === 'category') {
            // Navigate to event level
            setViewState({
                level: 'event',
                selectedCategoryId: node.id,
                selectedCategoryName: node.name,
            });
        } else if (viewState.level === 'event') {
            // Navigate to market level
            const event = getEventById(node.id);
            setViewState({
                ...viewState,
                level: 'market',
                selectedEventId: node.id,
                selectedEventTitle: event?.title || node.name,
            });
        }
        // Market level clicks are handled by HeatMap (opens Polymarket)
    };

    // Handle breadcrumb navigation
    const handleBreadcrumbNavigate = (level: ViewLevel) => {
        if (level === 'category') {
            setViewState({ level: 'category' });
        } else if (level === 'event' && viewState.selectedCategoryId) {
            setViewState({
                level: 'event',
                selectedCategoryId: viewState.selectedCategoryId,
                selectedCategoryName: viewState.selectedCategoryName,
            });
        }
        // 'market' level navigation from breadcrumb keeps current state
    };

    // Back button handler
    const handleBack = () => {
        if (viewState.level === 'market') {
            setViewState({
                level: 'event',
                selectedCategoryId: viewState.selectedCategoryId,
                selectedCategoryName: viewState.selectedCategoryName,
            });
        } else if (viewState.level === 'event') {
            setViewState({ level: 'category' });
        }
    };

    return (
        <main className="flex h-screen flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
                        P
                    </div>
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Polymarket{' '}
                        <span className="font-light text-zinc-500">Heat Map</span>
                    </h1>
                </div>

                <div className="flex items-center space-x-6 text-sm">
                    <div className="flex items-center space-x-2">
                        <Settings2 className="w-4 h-4 text-zinc-500" />
                        <span className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">
                            Min Volume:
                        </span>
                        <input
                            type="range"
                            min="10000"
                            max="10000000"
                            step="100000"
                            value={minVolume}
                            onChange={(e) => setMinVolume(Number(e.target.value))}
                            className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
                        />
                        <span className="font-mono text-zinc-300 w-16 text-right">
                            ${(minVolume / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </div>
            </header>

            {/* Navigation Bar */}
            <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900/30">
                {/* Back Button */}
                {viewState.level !== 'category' && (
                    <button
                        onClick={handleBack}
                        className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Back</span>
                    </button>
                )}

                {/* Breadcrumb */}
                <Breadcrumb viewState={viewState} onNavigate={handleBreadcrumbNavigate} />

                {/* Loading indicator */}
                {isLoading && (
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 relative w-full overflow-hidden">
                <div className="w-full h-full p-4">
                    {isLoading && currentData.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                <span className="text-zinc-500">Loading market data...</span>
                            </div>
                        </div>
                    ) : (
                        <HeatMap
                            level={viewState.level}
                            data={currentData}
                            onNodeClick={handleNodeClick}
                            minVolume={viewState.level === 'category' ? 0 : minVolume}
                        />
                    )}
                </div>
            </div>

            {/* Footer with legend */}
            <footer className="flex items-center justify-between px-6 py-2 border-t border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500">
                <div className="flex items-center gap-4">
                    {viewState.level === 'market' ? (
                        <>
                            <span>Color: Probability</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-red-500" />
                                <span>NO</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-blue-500" />
                                <span>YES</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <span>Color: Activity</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-green-500" />
                                <span>Low</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-yellow-500" />
                                <span>Medium</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-sm bg-red-500" />
                                <span>High</span>
                            </div>
                        </>
                    )}
                </div>
                <span>Size = Volume | Click to drill down</span>
            </footer>
        </main>
    );
}
