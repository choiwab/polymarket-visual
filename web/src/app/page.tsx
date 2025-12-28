'use client';

import React, { useState, useMemo } from 'react';
import HeatMap from '@/components/viz/HeatMap';
import WorldMap from '@/components/viz/WorldMap';
import { DependencyMap } from '@/components/viz/DependencyMap';
import Breadcrumb from '@/components/nav/Breadcrumb';
import TabNavigation from '@/components/nav/TabNavigation';
import EventPanel from '@/components/panels/EventPanel';
import { useEventData } from '@/hooks/useEventData';
import { useGeoEnrichedEvents } from '@/hooks/useGeoEnrichedEvents';
import {
    ViewState,
    ViewLevel,
    Category,
    ProcessedEvent,
    MarketNode,
    TabId,
    PanelState,
    DependencyMapFilters,
} from '@/lib/types';
import { Settings2, ArrowLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';

export default function Home() {
    // Heat Map state
    const [minVolume, setMinVolume] = useState(100000);
    const [viewState, setViewState] = useState<ViewState>({
        level: 'category',
    });

    // Tab state
    const [activeTab, setActiveTab] = useState<TabId>('heatmap');

    // Panel state (for World Map)
    const [panelState, setPanelState] = useState<PanelState>({ isOpen: false });

    // Dependency Map state
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
    const [dependencyFilters, setDependencyFilters] = useState<DependencyMapFilters>({
        correlationThreshold: 0.6,
        timeWindow: '24h',
        dependencyType: 'all',
        showCrossEvent: true,
        maxEdges: 10,
        minSharedEntities: 1,
        maxDaysDiff: 14,
    });

    // Data hooks
    const { events, categories, getEventsForCategory, getEventById, isLoading } =
        useEventData();
    const { mappableEvents, getGeoEventById, geoStats } = useGeoEnrichedEvents();

    // Get the current data based on view level (for Heat Map)
    const currentData = useMemo(():
        | Category[]
        | ProcessedEvent[]
        | MarketNode[] => {
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

    // Handle node click for navigation (Heat Map)
    const handleNodeClick = (node: { id: string; name: string }) => {
        if (viewState.level === 'category') {
            setViewState({
                level: 'event',
                selectedCategoryId: node.id,
                selectedCategoryName: node.name,
            });
        } else if (viewState.level === 'event') {
            const event = getEventById(node.id);
            setViewState({
                ...viewState,
                level: 'market',
                selectedEventId: node.id,
                selectedEventTitle: event?.title || node.name,
            });
        }
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
    };

    // Back button handler (Heat Map)
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

    // Handle event click from WorldMap
    const handleWorldMapEventClick = (eventId: string) => {
        setPanelState({ isOpen: true, eventId });
    };

    // Close panel
    const handleClosePanel = () => {
        setPanelState({ isOpen: false });
    };

    // Get selected event for panel
    const selectedEvent = panelState.eventId
        ? getGeoEventById(panelState.eventId)
        : null;

    return (
        <main className="flex h-screen flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="flex items-center space-x-3 w-64">
                    <Image
                        src="/pmv-logo.png"
                        alt="PolyViz Logo"
                        width={50}
                        height={50}
                        className="object-contain"
                    />
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Polymarket{' '}
                        <span className="font-light text-zinc-500">Live</span>
                    </h1>
                </div>

                {/* Tab Navigation */}
                <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Right section - fixed width to keep tabs centered */}
                <div className="w-64 flex justify-end">
                    {/* Settings (only show for heatmap) */}
                    {activeTab === 'heatmap' && (
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
                                    onChange={(e) =>
                                        setMinVolume(Number(e.target.value))
                                    }
                                    className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
                                />
                                <span className="font-mono text-zinc-300 w-16 text-right">
                                    ${(minVolume / 1000000).toFixed(1)}M
                                </span>
                            </div>
                        </div>
                    )}

                    {/* World Map stats */}
                    {activeTab === 'worldmap' && (
                        <div className="flex items-center space-x-4 text-sm text-zinc-400">
                            <span>
                                <span className="text-white font-medium">
                                    {geoStats.mappable}
                                </span>{' '}
                                mappable events
                            </span>
                        </div>
                    )}
                </div>
            </header>

            {/* Navigation Bar - only show for heatmap */}
            {activeTab === 'heatmap' && (
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
                    <Breadcrumb
                        viewState={viewState}
                        onNavigate={handleBreadcrumbNavigate}
                    />

                    {/* Loading indicator */}
                    {isLoading && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin ml-auto" />
                    )}
                </div>
            )}

            {/* Main Content */}
            <div className="flex-1 relative w-full overflow-hidden">
                {activeTab === 'heatmap' ? (
                    <div className="w-full h-full p-4">
                        {isLoading && currentData.length === 0 ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                                    <span className="text-zinc-500">
                                        Loading market data...
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <HeatMap
                                level={viewState.level}
                                data={currentData}
                                onNodeClick={handleNodeClick}
                                minVolume={
                                    viewState.level === 'category'
                                        ? 0
                                        : minVolume
                                }
                            />
                        )}
                    </div>
                ) : activeTab === 'worldmap' ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="text-6xl">🚧</div>
                            <h2 className="text-2xl font-bold text-white">Under Construction</h2>
                            <p className="text-zinc-400 max-w-md">
                                The World Map feature is currently being improved. Please check back soon!
                            </p>
                        </div>
                    </div>
                ) : activeTab === 'dependency' ? (
                    <DependencyMap
                        events={events}
                        selectedMarketId={selectedMarketId}
                        onMarketSelect={setSelectedMarketId}
                        filters={dependencyFilters}
                        onFiltersChange={setDependencyFilters}
                    />
                ) : null}
            </div>

            {/* Footer with legend */}
            <footer className="flex items-center justify-between px-6 py-2 border-t border-zinc-800 bg-zinc-900/30 text-xs text-zinc-500">
                <div className="flex items-center gap-4">
                    {activeTab === 'worldmap' ? (
                        <>
                            <span>Size = Volume</span>
                            <span>|</span>
                            <span>Color: Activity</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span>Low</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                <span>Medium</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span>High</span>
                            </div>
                            <span>|</span>
                            <span>Opacity = Location Confidence</span>
                        </>
                    ) : activeTab === 'dependency' ? (
                        <>
                            <span>Node Size = Volume</span>
                            <span>|</span>
                            <span>Node Color = Category</span>
                            <span>|</span>
                            <span>Edge:</span>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-zinc-500" />
                                <span>Structural</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-green-500" />
                                <span>+Corr</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-red-500" />
                                <span>-Corr</span>
                            </div>
                        </>
                    ) : viewState.level === 'market' ? (
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
                <span>
                    {activeTab === 'worldmap'
                        ? 'Click event for details'
                        : activeTab === 'dependency'
                        ? 'Click node to recenter | Hover edge for details'
                        : 'Size = Volume | Click to drill down'}
                </span>
            </footer>

            {/* Event Panel (for WorldMap) */}
            <EventPanel
                event={selectedEvent || null}
                isOpen={panelState.isOpen}
                onClose={handleClosePanel}
            />
        </main>
    );
}
