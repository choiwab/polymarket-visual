import { DependencyEdge, MarketNode, ProcessedEvent } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TemporalProximity {
    daysDiff: number;
    precedence: 'before' | 'after' | 'same';
}

/**
 * Compute temporal proximity between two end dates.
 * Returns null if either date is missing or invalid.
 */
export function computeTemporalProximity(
    endDateA: string | undefined,
    endDateB: string | undefined
): TemporalProximity | null {
    if (!endDateA || !endDateB) return null;

    const dateA = new Date(endDateA).getTime();
    const dateB = new Date(endDateB).getTime();

    if (isNaN(dateA) || isNaN(dateB)) return null;

    const diffMs = dateB - dateA;
    const daysDiff = Math.abs(diffMs / DAY_MS);

    let precedence: 'before' | 'after' | 'same';
    if (Math.abs(diffMs) < DAY_MS) {
        precedence = 'same';
    } else if (diffMs < 0) {
        precedence = 'before';
    } else {
        precedence = 'after';
    }

    return { daysDiff, precedence };
}

/**
 * Format relative time for display.
 */
function formatTemporalExplanation(proximity: TemporalProximity): string {
    const days = Math.round(proximity.daysDiff);

    if (days === 0 || proximity.precedence === 'same') {
        return 'Resolves on same day';
    }

    if (days === 1) {
        return proximity.precedence === 'before'
            ? 'Resolves 1 day earlier'
            : 'Resolves 1 day later';
    }

    if (days <= 7) {
        return proximity.precedence === 'before'
            ? `Resolves ${days} days earlier`
            : `Resolves ${days} days later`;
    }

    const weeks = Math.round(days / 7);
    if (weeks === 1) {
        return proximity.precedence === 'before'
            ? 'Resolves ~1 week earlier'
            : 'Resolves ~1 week later';
    }

    return proximity.precedence === 'before'
        ? `Resolves ~${weeks} weeks earlier`
        : `Resolves ~${weeks} weeks later`;
}

/**
 * Get the end date for a market, checking market-level first, then event-level.
 */
function getMarketEndDate(
    market: MarketNode,
    events: ProcessedEvent[]
): string | undefined {
    // Check market-level endDate first
    if (market.endDate) return market.endDate;

    // Fall back to event-level endDate
    const event = events.find(e => e.id === market.eventId);
    return event?.endDate;
}

/**
 * Find markets with similar resolution timing.
 * Markets that resolve close together may be correlated or have causal relationships.
 */
export function findTemporalDependencies(
    targetMarketId: string,
    targetEndDate: string | undefined,
    allMarkets: MarketNode[],
    events: ProcessedEvent[],
    options: { maxDaysDiff: number }
): DependencyEdge[] {
    if (!targetEndDate) return [];

    const edges: DependencyEdge[] = [];

    for (const market of allMarkets) {
        if (market.id === targetMarketId) continue;

        const marketEndDate = getMarketEndDate(market, events);
        const proximity = computeTemporalProximity(targetEndDate, marketEndDate);

        if (!proximity || proximity.daysDiff > options.maxDaysDiff) continue;

        // Weight: closer = higher weight (inverse of days diff)
        // Markets resolving on same day get weight 1.0
        // Weight decreases linearly to 0 at maxDaysDiff
        const weight = 1 - (proximity.daysDiff / options.maxDaysDiff);

        const explanation = formatTemporalExplanation(proximity);

        edges.push({
            id: `temporal-${targetMarketId}-${market.id}`,
            sourceId: targetMarketId,
            targetId: market.id,
            type: 'temporal',
            weight,
            daysDiff: proximity.daysDiff,
            precedence: proximity.precedence,
            explanation,
        });
    }

    // Sort by weight (closest resolution dates first)
    return edges.sort((a, b) => b.weight - a.weight);
}

/**
 * Group markets by resolution date (within a tolerance).
 * Useful for finding clusters of markets that resolve together.
 */
export function clusterByResolutionDate(
    events: ProcessedEvent[],
    toleranceDays: number = 1
): Map<string, { dateKey: string; markets: Array<{ id: string; question: string; endDate: string }> }> {
    const clusters = new Map<string, { dateKey: string; markets: Array<{ id: string; question: string; endDate: string }> }>();

    for (const event of events) {
        for (const market of event.markets) {
            const endDate = market.endDate || event.endDate;
            if (!endDate) continue;

            const date = new Date(endDate);
            if (isNaN(date.getTime())) continue;

            // Create a date key (rounded to tolerance)
            const daysSinceEpoch = Math.floor(date.getTime() / DAY_MS);
            const roundedDays = Math.round(daysSinceEpoch / toleranceDays) * toleranceDays;
            const dateKey = new Date(roundedDays * DAY_MS).toISOString().split('T')[0];

            const existing = clusters.get(dateKey);
            const marketInfo = { id: market.id, question: market.question, endDate };

            if (existing) {
                existing.markets.push(marketInfo);
            } else {
                clusters.set(dateKey, { dateKey, markets: [marketInfo] });
            }
        }
    }

    return clusters;
}

/**
 * Find markets that might be leading indicators.
 * A leading market resolves before the target, potentially influencing its outcome.
 */
export function findLeadingIndicators(
    targetMarketId: string,
    targetEndDate: string | undefined,
    allMarkets: MarketNode[],
    events: ProcessedEvent[],
    options: { maxDaysBefore: number; minDaysBefore: number }
): DependencyEdge[] {
    if (!targetEndDate) return [];

    const edges: DependencyEdge[] = [];

    for (const market of allMarkets) {
        if (market.id === targetMarketId) continue;

        const marketEndDate = getMarketEndDate(market, events);
        const proximity = computeTemporalProximity(targetEndDate, marketEndDate);

        if (!proximity) continue;

        // Only include markets that resolve BEFORE the target
        if (proximity.precedence !== 'before') continue;

        // Check if within the "leading" window
        if (proximity.daysDiff < options.minDaysBefore || proximity.daysDiff > options.maxDaysBefore) {
            continue;
        }

        // Weight based on how close to the target (closer = potentially more relevant)
        const weight = 1 - ((proximity.daysDiff - options.minDaysBefore) / (options.maxDaysBefore - options.minDaysBefore));

        edges.push({
            id: `leading-${targetMarketId}-${market.id}`,
            sourceId: targetMarketId,
            targetId: market.id,
            type: 'temporal',
            weight,
            daysDiff: proximity.daysDiff,
            precedence: 'before',
            explanation: `Potential leading indicator - resolves ${Math.round(proximity.daysDiff)} days earlier`,
        });
    }

    return edges.sort((a, b) => b.weight - a.weight);
}
