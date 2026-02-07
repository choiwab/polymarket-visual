'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessedEvent, DependencyMapFilters, DependencyEdge, DependencyNode } from '@/lib/types';
import { useDependencyData } from '@/hooks/useDependencyData';
import DependencyGraphViz from './DependencyGraph';
import DependencyFilters from './DependencyFilters';
import DependencyTooltip from './DependencyTooltip';
import MarketSelector from './MarketSelector';
import { Loader2, HelpCircle, X } from 'lucide-react';

interface DependencyMapProps {
    events: ProcessedEvent[];
    selectedMarketId: string | null;
    onMarketSelect: (marketId: string | null) => void;
    filters: DependencyMapFilters;
    onFiltersChange: (filters: DependencyMapFilters) => void;
}

export default function DependencyMap({
    events,
    selectedMarketId,
    onMarketSelect,
    filters,
    onFiltersChange,
}: DependencyMapProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [hoveredEdge, setHoveredEdge] = useState<DependencyEdge | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
    const [showManual, setShowManual] = useState(false);

    // Fetch dependency data
    const { graph, isLoading, isError, stats } = useDependencyData(
        selectedMarketId,
        filters,
        events
    );

    // Handle container resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateDimensions = () => {
            const rect = container.getBoundingClientRect();
            setDimensions({
                width: rect.width,
                height: rect.height,
            });
        };

        updateDimensions();

        const resizeObserver = new ResizeObserver(updateDimensions);
        resizeObserver.observe(container);

        return () => resizeObserver.disconnect();
    }, []);

    // Handle edge hover
    const handleEdgeHover = useCallback(
        (edge: DependencyEdge | null, event?: React.MouseEvent) => {
            setHoveredEdge(edge);
            if (edge && event) {
                setTooltipPosition({ x: event.clientX, y: event.clientY });
            } else {
                setTooltipPosition(null);
            }
        },
        []
    );

    // Handle node click - recenter on clicked market
    const handleNodeClick = useCallback(
        (node: DependencyNode) => {
            if (node.id !== selectedMarketId) {
                onMarketSelect(node.id);
            }
        },
        [selectedMarketId, onMarketSelect]
    );

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <MarketSelector
                    events={events}
                    selectedMarketId={selectedMarketId}
                    onMarketSelect={onMarketSelect}
                />

                <div className="flex items-center gap-3">
                    {selectedMarketId && (
                        <DependencyFilters
                            filters={filters}
                            onFiltersChange={onFiltersChange}
                            stats={stats}
                        />
                    )}
                    <button
                        onClick={() => setShowManual(true)}
                        className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                        title="How it works"
                    >
                        <HelpCircle className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Graph Container */}
            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden bg-zinc-900"
            >
                {/* Loading State */}
                {isLoading && selectedMarketId && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 z-10">
                        <div className="flex items-center gap-3 text-zinc-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading price data...</span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {isError && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-red-400 text-center">
                            <p>Failed to load dependency data</p>
                            <p className="text-sm text-zinc-500 mt-1">
                                {isError.message || 'Unknown error'}
                            </p>
                        </div>
                    </div>
                )}

                {/* Empty State */}
                {!selectedMarketId && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                                <svg
                                    className="w-8 h-8 text-zinc-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-lg font-medium text-zinc-300 mb-2">
                                Explore Market Dependencies
                            </h3>
                            <p className="text-sm text-zinc-500 mb-4">
                                Select a market above to see how it connects to other markets through
                                event relationships and price correlations.
                            </p>
                            <p className="text-xs text-zinc-600">
                                Tip: Markets in the same event are structurally connected.
                                Price correlations show how markets move together.
                            </p>
                        </div>
                    </div>
                )}

                {/* Graph Visualization */}
                {graph && !isLoading && (
                    <DependencyGraphViz
                        graph={graph}
                        width={dimensions.width}
                        height={dimensions.height}
                        onNodeClick={handleNodeClick}
                        onEdgeHover={handleEdgeHover}
                    />
                )}

                {/* Legend */}
                {selectedMarketId && (
                    <div className="absolute bottom-4 left-4 bg-zinc-800/90 backdrop-blur-sm rounded-lg p-3 text-xs">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-zinc-500" />
                                <span className="text-zinc-400">Same event</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                <span className="text-zinc-400">Positive correlation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                <span className="text-zinc-400">Negative correlation</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span className="text-zinc-400">Shared entity</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                <span className="text-zinc-400">Similar timing</span>
                            </div>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-700">
                                <div className="w-4 h-0.5 bg-zinc-400" style={{ borderStyle: 'dashed' }} />
                                <span className="text-zinc-500">Dashed = structural/temporal</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Tooltip */}
            <DependencyTooltip edge={hoveredEdge} position={tooltipPosition} />

            {/* Manual Modal */}
            {showManual && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowManual(false)}
                >
                    <div
                        className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 rounded-t-xl">
                            <h2 className="text-base font-semibold text-white">
                                How the Dependency Map Works
                            </h2>
                            <button
                                onClick={() => setShowManual(false)}
                                className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 space-y-4 text-sm text-zinc-300 leading-relaxed">
                            <section>
                                <h3 className="text-white font-medium mb-1">Overview</h3>
                                <p className="text-zinc-400">
                                    The dependency map visualizes how prediction markets are connected.
                                    Select a center market, and the graph shows other markets linked to it
                                    through various relationship types.
                                </p>
                            </section>

                            <section>
                                <h3 className="text-white font-medium mb-2">Edge Types</h3>
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <div className="w-3 h-3 rounded-full bg-zinc-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-white">Structural (Event)</span>
                                            <span className="text-zinc-500"> &mdash; Markets belong to the same event.
                                                E.g., &quot;Will X win?&quot; and &quot;Will Y win?&quot; under a single election event.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-3 h-3 rounded-full bg-green-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-white">Positive Correlation</span>
                                            <span className="text-zinc-500"> &mdash; Prices move in the same direction.
                                                When one goes up, the other tends to go up too.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-white">Negative Correlation</span>
                                            <span className="text-zinc-500"> &mdash; Prices move in opposite directions.
                                                When one goes up, the other tends to go down.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-3 h-3 rounded-full bg-blue-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-white">Shared Entity</span>
                                            <span className="text-zinc-500"> &mdash; Markets mention the same people, organizations, or topics
                                                (e.g., two markets both referencing &quot;Fed&quot; or &quot;Trump&quot;).</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <div className="w-3 h-3 rounded-full bg-purple-500 mt-0.5 shrink-0" />
                                        <div>
                                            <span className="text-white">Similar Timing</span>
                                            <span className="text-zinc-500"> &mdash; Markets resolve around the same time,
                                                suggesting they may be affected by the same upcoming events.</span>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-white font-medium mb-2">Controls</h3>
                                <div className="space-y-1.5 text-zinc-400">
                                    <p><span className="text-zinc-300">Window (1H / 24H / 7D)</span> &mdash; Time period used for correlation calculation.</p>
                                    <p><span className="text-zinc-300">Type filter</span> &mdash; Show only a specific edge type, or all at once.</p>
                                    <p><span className="text-zinc-300">Corr threshold</span> &mdash; Minimum correlation strength to display an edge (higher = fewer, stronger connections).</p>
                                    <p><span className="text-zinc-300">Cross-event</span> &mdash; When enabled, shows connections to markets in different events. When off, only same-event connections appear.</p>
                                    <p><span className="text-zinc-300">Max edges</span> &mdash; Limits the total number of connections shown to keep the graph readable.</p>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-white font-medium mb-2">Interactions</h3>
                                <div className="space-y-1.5 text-zinc-400">
                                    <p><span className="text-zinc-300">Click a node</span> &mdash; Recenter the graph on that market.</p>
                                    <p><span className="text-zinc-300">Hover an edge</span> &mdash; See the relationship details and strength.</p>
                                    <p><span className="text-zinc-300">Node size</span> &mdash; Proportional to trading volume.</p>
                                    <p><span className="text-zinc-300">Edge thickness</span> &mdash; Proportional to relationship strength.</p>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
