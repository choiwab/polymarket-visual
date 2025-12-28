import { useMemo } from 'react';
import {
    DependencyGraph,
    DependencyNode,
    DependencyEdge,
    DependencyMapFilters,
    ProcessedEvent,
    MarketNode,
    PriceHistoryPoint,
} from '@/lib/types';
import { usePriceHistory } from './usePriceHistory';
import {
    findStructuralDependencies,
    findCorrelatedMarkets,
    buildCorrelationEdges,
    computeVolatility,
} from '@/lib/correlation';
import { extractEntities, findEntityBasedDependencies } from '@/lib/entities';
import { findTemporalDependencies } from '@/lib/temporal';
import { CATEGORIES } from '@/lib/categories';

interface UseDependencyDataResult {
    graph: DependencyGraph | null;
    isLoading: boolean;
    isError: Error | null;
    stats: {
        totalNodes: number;
        totalEdges: number;
        structuralEdges: number;
        correlationEdges: number;
        entityEdges: number;
        temporalEdges: number;
    };
}

/**
 * Main hook for building the dependency graph.
 * Combines structural dependencies (same event) with correlation dependencies.
 */
export function useDependencyData(
    centerMarketId: string | null,
    filters: DependencyMapFilters,
    events: ProcessedEvent[]
): UseDependencyDataResult {
    // Get all markets from events
    const allMarkets = useMemo(() => {
        const markets: MarketNode[] = [];
        for (const event of events) {
            for (const market of event.markets) {
                markets.push({ ...market, eventId: event.id });
            }
        }
        return markets;
    }, [events]);

    // Find the center market and its event
    const centerMarket = useMemo(() => {
        if (!centerMarketId) return null;
        return allMarkets.find((m) => m.id === centerMarketId) || null;
    }, [centerMarketId, allMarkets]);

    const centerEvent = useMemo(() => {
        if (!centerMarket?.eventId) return null;
        return events.find((e) => e.id === centerMarket.eventId) || null;
    }, [centerMarket, events]);

    // Get markets to fetch price history for
    // Include center market + all markets in same event + top volume markets
    const marketsForHistory = useMemo(() => {
        if (!centerMarketId) return [];

        const marketMap = new Map<string, MarketNode>();

        // Add center market
        if (centerMarket) {
            marketMap.set(centerMarketId, centerMarket);
        }

        // Add markets from same event
        if (centerEvent) {
            for (const market of centerEvent.markets) {
                marketMap.set(market.id, market);
            }
        }

        // Add top 20 markets by volume for cross-event correlations
        if (filters.showCrossEvent) {
            const sortedMarkets = [...allMarkets]
                .filter(m => m.clobTokenIds && m.clobTokenIds.length > 0)
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 20);
            for (const market of sortedMarkets) {
                marketMap.set(market.id, market);
            }
        }

        return Array.from(marketMap.values());
    }, [centerMarketId, centerMarket, centerEvent, allMarkets, filters.showCrossEvent]);

    // Build mapping from clobTokenId to marketId
    const { tokenToMarketMap, tokenIds } = useMemo(() => {
        const map = new Map<string, string>();
        const ids: string[] = [];

        for (const market of marketsForHistory) {
            // Use the first clobTokenId (YES token) for price history
            if (market.clobTokenIds && market.clobTokenIds.length > 0) {
                const tokenId = market.clobTokenIds[0];
                map.set(tokenId, market.id);
                ids.push(tokenId);
            }
        }

        return { tokenToMarketMap: map, tokenIds: ids };
    }, [marketsForHistory]);

    // Fetch price histories using clobTokenIds
    const { histories: tokenHistories, isLoading, isError } = usePriceHistory(
        tokenIds,
        filters.timeWindow
    );

    // Map token histories back to market IDs
    const histories = useMemo(() => {
        const marketHistories = new Map<string, PriceHistoryPoint[]>();

        for (const [tokenId, history] of tokenHistories) {
            const marketId = tokenToMarketMap.get(tokenId);
            if (marketId && history.length > 0) {
                marketHistories.set(marketId, history);
            }
        }

        return marketHistories;
    }, [tokenHistories, tokenToMarketMap]);

    // Build the dependency graph
    const graph = useMemo((): DependencyGraph | null => {
        if (!centerMarketId || !centerMarket) return null;

        // Use a map to deduplicate edges between the same pair of markets
        // Key: "sourceId-targetId" (normalized so smaller ID comes first)
        const edgeMap = new Map<string, DependencyEdge>();
        const nodeMap = new Map<string, DependencyNode>();

        // Helper to get normalized edge key (ensures A-B and B-A are the same)
        const getEdgePairKey = (sourceId: string, targetId: string) => {
            return sourceId < targetId ? `${sourceId}-${targetId}` : `${targetId}-${sourceId}`;
        };

        // Always add center node
        nodeMap.set(centerMarketId, marketToNode(centerMarket, centerEvent, histories));

        // Find structural dependencies
        if (filters.dependencyType === 'all' || filters.dependencyType === 'structural') {
            const structuralEdges = findStructuralDependencies(centerMarketId, events);

            for (const edge of structuralEdges) {
                // Only add if within maxEdges and passes cross-event filter
                if (!filters.showCrossEvent && edge.sharedEventId !== centerEvent?.id) {
                    continue;
                }

                const pairKey = getEdgePairKey(edge.sourceId, edge.targetId);
                // Only add if no edge exists yet for this pair
                if (!edgeMap.has(pairKey)) {
                    edgeMap.set(pairKey, {
                        ...edge,
                        id: `structural-${pairKey}`, // Unique ID with type prefix
                    });
                }

                // Add the target node if not already present
                if (!nodeMap.has(edge.targetId)) {
                    const targetMarket = allMarkets.find((m) => m.id === edge.targetId);
                    const targetEvent = events.find((e) => e.id === targetMarket?.eventId);
                    if (targetMarket) {
                        nodeMap.set(edge.targetId, marketToNode(targetMarket, targetEvent, histories));
                    }
                }
            }
        }

        // Find correlation dependencies
        if (
            (filters.dependencyType === 'all' || filters.dependencyType === 'correlation') &&
            histories.size > 1
        ) {
            const correlations = findCorrelatedMarkets(centerMarketId, histories, {
                threshold: filters.correlationThreshold,
                maxResults: filters.maxEdges,
            });

            const correlationEdges = buildCorrelationEdges(
                centerMarketId,
                correlations,
                filters.timeWindow
            );

            for (const edge of correlationEdges) {
                // Check cross-event filter
                const targetMarket = allMarkets.find((m) => m.id === edge.targetId);
                if (!filters.showCrossEvent && targetMarket?.eventId !== centerEvent?.id) {
                    continue;
                }

                const pairKey = getEdgePairKey(edge.sourceId, edge.targetId);
                // Correlation edges override structural edges (more informative)
                edgeMap.set(pairKey, {
                    ...edge,
                    id: `correlation-${pairKey}`, // Unique ID with type prefix
                });

                // Add the target node if not already present
                if (!nodeMap.has(edge.targetId)) {
                    const targetEvent = events.find((e) => e.id === targetMarket?.eventId);
                    if (targetMarket) {
                        nodeMap.set(edge.targetId, marketToNode(targetMarket, targetEvent, histories));
                    }
                }
            }
        }

        // Find entity-based dependencies (shared named entities)
        if (filters.dependencyType === 'all' || filters.dependencyType === 'entity') {
            // Extract entities from center market and its event
            const centerEntities = extractEntities(centerMarket.question);
            if (centerEvent) {
                centerEntities.push(...extractEntities(centerEvent.title));
            }

            if (centerEntities.length > 0) {
                const entityEdges = findEntityBasedDependencies(
                    centerMarketId,
                    centerEntities,
                    allMarkets,
                    events,
                    { minSharedEntities: filters.minSharedEntities || 1 }
                );

                for (const edge of entityEdges) {
                    // Check cross-event filter
                    const targetMarket = allMarkets.find((m) => m.id === edge.targetId);
                    if (!filters.showCrossEvent && targetMarket?.eventId === centerEvent?.id) {
                        // Skip same-event markets for entity edges (structural already covers them)
                        continue;
                    }

                    const pairKey = getEdgePairKey(edge.sourceId, edge.targetId);
                    // Only add if no edge exists yet (don't override structural/correlation)
                    if (!edgeMap.has(pairKey)) {
                        edgeMap.set(pairKey, {
                            ...edge,
                            id: `entity-${pairKey}`,
                        });

                        // Add the target node if not already present
                        if (!nodeMap.has(edge.targetId) && targetMarket) {
                            const targetEvent = events.find((e) => e.id === targetMarket.eventId);
                            nodeMap.set(edge.targetId, marketToNode(targetMarket, targetEvent, histories));
                        }
                    }
                }
            }
        }

        // Find temporal dependencies (overlapping resolution windows)
        if (filters.dependencyType === 'all' || filters.dependencyType === 'temporal') {
            const centerEndDate = centerMarket.endDate || centerEvent?.endDate;

            if (centerEndDate) {
                const temporalEdges = findTemporalDependencies(
                    centerMarketId,
                    centerEndDate,
                    allMarkets,
                    events,
                    { maxDaysDiff: filters.maxDaysDiff || 14 }
                );

                for (const edge of temporalEdges) {
                    // Check cross-event filter
                    const targetMarket = allMarkets.find((m) => m.id === edge.targetId);
                    if (!filters.showCrossEvent && targetMarket?.eventId === centerEvent?.id) {
                        // Skip same-event markets for temporal edges
                        continue;
                    }

                    const pairKey = getEdgePairKey(edge.sourceId, edge.targetId);
                    // Only add if no edge exists yet (don't override other types)
                    if (!edgeMap.has(pairKey)) {
                        edgeMap.set(pairKey, {
                            ...edge,
                            id: `temporal-${pairKey}`,
                        });

                        // Add the target node if not already present
                        if (!nodeMap.has(edge.targetId) && targetMarket) {
                            const targetEvent = events.find((e) => e.id === targetMarket.eventId);
                            nodeMap.set(edge.targetId, marketToNode(targetMarket, targetEvent, histories));
                        }
                    }
                }
            }
        }

        // Convert edge map to array and limit total edges
        const limitedEdges = Array.from(edgeMap.values())
            .sort((a, b) => b.weight - a.weight)
            .slice(0, filters.maxEdges);

        // Only include nodes that are connected
        const connectedNodeIds = new Set<string>([centerMarketId]);
        for (const edge of limitedEdges) {
            connectedNodeIds.add(edge.sourceId);
            connectedNodeIds.add(edge.targetId);
        }

        const nodes = Array.from(nodeMap.values()).filter((n) =>
            connectedNodeIds.has(n.id)
        );

        // Mark center node as fixed
        const centerNode = nodes.find((n) => n.id === centerMarketId);
        if (centerNode) {
            centerNode.fx = null; // Will be set to center by the visualization
            centerNode.fy = null;
        }

        return {
            nodes,
            edges: limitedEdges,
            centerNodeId: centerMarketId,
        };
    }, [
        centerMarketId,
        centerMarket,
        centerEvent,
        events,
        allMarkets,
        histories,
        filters,
    ]);

    // Compute stats
    const stats = useMemo(() => {
        if (!graph) {
            return {
                totalNodes: 0,
                totalEdges: 0,
                structuralEdges: 0,
                correlationEdges: 0,
                entityEdges: 0,
                temporalEdges: 0,
            };
        }

        return {
            totalNodes: graph.nodes.length,
            totalEdges: graph.edges.length,
            structuralEdges: graph.edges.filter((e) => e.type === 'structural').length,
            correlationEdges: graph.edges.filter((e) => e.type === 'correlation').length,
            entityEdges: graph.edges.filter((e) => e.type === 'entity').length,
            temporalEdges: graph.edges.filter((e) => e.type === 'temporal').length,
        };
    }, [graph]);

    return {
        graph,
        isLoading,
        isError: isError || null,
        stats,
    };
}

/**
 * Convert a MarketNode to a DependencyNode with additional graph properties.
 */
function marketToNode(
    market: MarketNode,
    event: ProcessedEvent | null | undefined,
    histories: Map<string, PriceHistoryPoint[]>
): DependencyNode {
    const categoryName = getCategoryName(event?.categoryId || 'other');
    const history = histories.get(market.id);

    return {
        id: market.id,
        marketId: market.id,
        eventId: market.eventId || event?.id || '',
        eventTitle: event?.title || market.group || '',
        question: market.question,
        volume: market.volume,
        volume24hr: market.volume24hr || 0,
        outcomeProb: market.outcomeProb,
        categoryId: event?.categoryId || 'other',
        categoryName,
        slug: market.slug,
        volatility: history ? computeVolatility(history) : 0,
    };
}

/**
 * Get category display name from ID.
 */
function getCategoryName(categoryId: string): string {
    for (const name of CATEGORIES) {
        if (name.toLowerCase().replace(/\s+/g, '-') === categoryId) {
            return name;
        }
    }
    return 'Other';
}
