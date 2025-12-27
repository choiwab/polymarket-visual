import { useMemo } from 'react';
import {
    DependencyGraph,
    DependencyNode,
    DependencyEdge,
    DependencyMapFilters,
    ProcessedEvent,
    MarketNode,
} from '@/lib/types';
import { usePriceHistory } from './usePriceHistory';
import {
    findStructuralDependencies,
    findCorrelatedMarkets,
    buildCorrelationEdges,
    computeVolatility,
} from '@/lib/correlation';
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

    // Get market IDs to fetch price history for
    // Include center market + all markets in same event + top volume markets
    const marketIdsForHistory = useMemo(() => {
        if (!centerMarketId) return [];

        const ids = new Set<string>([centerMarketId]);

        // Add markets from same event
        if (centerEvent) {
            for (const market of centerEvent.markets) {
                ids.add(market.id);
            }
        }

        // Add top 20 markets by volume for cross-event correlations
        if (filters.showCrossEvent) {
            const sortedMarkets = [...allMarkets]
                .sort((a, b) => b.volume - a.volume)
                .slice(0, 20);
            for (const market of sortedMarkets) {
                ids.add(market.id);
            }
        }

        return Array.from(ids);
    }, [centerMarketId, centerEvent, allMarkets, filters.showCrossEvent]);

    // Fetch price histories
    const { histories, isLoading, isError } = usePriceHistory(
        marketIdsForHistory,
        filters.timeWindow
    );

    // Build the dependency graph
    const graph = useMemo((): DependencyGraph | null => {
        if (!centerMarketId || !centerMarket) return null;

        const edges: DependencyEdge[] = [];
        const nodeMap = new Map<string, DependencyNode>();

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

                edges.push(edge);

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

                edges.push(edge);

                // Add the target node if not already present
                if (!nodeMap.has(edge.targetId)) {
                    const targetEvent = events.find((e) => e.id === targetMarket?.eventId);
                    if (targetMarket) {
                        nodeMap.set(edge.targetId, marketToNode(targetMarket, targetEvent, histories));
                    }
                }
            }
        }

        // Limit total edges
        const limitedEdges = edges
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
            return { totalNodes: 0, totalEdges: 0, structuralEdges: 0, correlationEdges: 0 };
        }

        return {
            totalNodes: graph.nodes.length,
            totalEdges: graph.edges.length,
            structuralEdges: graph.edges.filter((e) => e.type === 'structural').length,
            correlationEdges: graph.edges.filter((e) => e.type === 'correlation').length,
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
    histories: Map<string, import('@/lib/types').PriceHistoryPoint[]>
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
