import { PriceHistoryPoint, DependencyEdge, ProcessedEvent, TimeWindow } from './types';

// ============================================
// Correlation Computation
// ============================================

interface CorrelationResult {
    correlation: number; // -1 to 1
    confidence: number; // 0 to 1 based on sample size
    n: number; // number of data points used
}

/**
 * Align two time series by timestamp using linear interpolation.
 * Returns arrays of equal length with matching timestamps.
 */
function alignTimeSeries(
    seriesA: PriceHistoryPoint[],
    seriesB: PriceHistoryPoint[]
): { alignedA: number[]; alignedB: number[] } {
    if (seriesA.length < 2 || seriesB.length < 2) {
        return { alignedA: [], alignedB: [] };
    }

    // Sort both series by timestamp
    const sortedA = [...seriesA].sort((a, b) => a.timestamp - b.timestamp);
    const sortedB = [...seriesB].sort((a, b) => a.timestamp - b.timestamp);

    // Find overlapping time range
    const startTime = Math.max(sortedA[0].timestamp, sortedB[0].timestamp);
    const endTime = Math.min(
        sortedA[sortedA.length - 1].timestamp,
        sortedB[sortedB.length - 1].timestamp
    );

    if (startTime >= endTime) {
        return { alignedA: [], alignedB: [] };
    }

    // Use seriesA timestamps as reference points within the overlap
    const alignedA: number[] = [];
    const alignedB: number[] = [];

    for (const pointA of sortedA) {
        if (pointA.timestamp < startTime || pointA.timestamp > endTime) continue;

        // Find interpolated value in seriesB for this timestamp
        const interpolatedB = interpolateAtTime(sortedB, pointA.timestamp);
        if (interpolatedB !== null) {
            alignedA.push(pointA.price);
            alignedB.push(interpolatedB);
        }
    }

    return { alignedA, alignedB };
}

/**
 * Linear interpolation to get value at a specific timestamp
 */
function interpolateAtTime(series: PriceHistoryPoint[], timestamp: number): number | null {
    // Find surrounding points
    let before: PriceHistoryPoint | null = null;
    let after: PriceHistoryPoint | null = null;

    for (let i = 0; i < series.length; i++) {
        if (series[i].timestamp <= timestamp) {
            before = series[i];
        }
        if (series[i].timestamp >= timestamp && after === null) {
            after = series[i];
            break;
        }
    }

    if (!before && !after) return null;
    if (!before) return after!.price;
    if (!after) return before.price;
    if (before.timestamp === after.timestamp) return before.price;

    // Linear interpolation
    const ratio = (timestamp - before.timestamp) / (after.timestamp - before.timestamp);
    return before.price + ratio * (after.price - before.price);
}

/**
 * Compute returns (price changes) from price series.
 * Uses simple returns: (p[i] - p[i-1]) / p[i-1]
 */
function computeReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
        if (prices[i - 1] !== 0) {
            returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
        } else {
            returns.push(0);
        }
    }
    return returns;
}

/**
 * Compute Pearson correlation coefficient between two arrays
 */
function pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let sumSqX = 0;
    let sumSqY = 0;

    for (let i = 0; i < n; i++) {
        const dx = x[i] - meanX;
        const dy = y[i] - meanY;
        numerator += dx * dy;
        sumSqX += dx * dx;
        sumSqY += dy * dy;
    }

    const denominator = Math.sqrt(sumSqX * sumSqY);
    if (denominator === 0) return 0;

    return numerator / denominator;
}

/**
 * Compute correlation between two price series using returns.
 */
export function computeCorrelation(
    seriesA: PriceHistoryPoint[],
    seriesB: PriceHistoryPoint[]
): CorrelationResult {
    const { alignedA, alignedB } = alignTimeSeries(seriesA, seriesB);

    if (alignedA.length < 5) {
        return { correlation: 0, confidence: 0, n: alignedA.length };
    }

    // Compute returns
    const returnsA = computeReturns(alignedA);
    const returnsB = computeReturns(alignedB);

    if (returnsA.length < 3) {
        return { correlation: 0, confidence: 0, n: returnsA.length };
    }

    const correlation = pearsonCorrelation(returnsA, returnsB);

    // Confidence based on sample size (more data = higher confidence)
    // At least 10 points for decent confidence, 50+ for high confidence
    const confidence = Math.min(1, Math.log10(returnsA.length + 1) / Math.log10(51));

    return {
        correlation: Math.max(-1, Math.min(1, correlation)), // Clamp to [-1, 1]
        confidence,
        n: returnsA.length,
    };
}

// ============================================
// Dependency Detection
// ============================================

export interface CorrelationEdge {
    targetId: string;
    correlation: number;
    confidence: number;
    n: number;
}

/**
 * Find markets with strongest correlations to the target market.
 */
export function findCorrelatedMarkets(
    targetMarketId: string,
    allHistories: Map<string, PriceHistoryPoint[]>,
    options: {
        threshold: number; // Min |correlation| to include
        maxResults: number;
    }
): CorrelationEdge[] {
    const targetHistory = allHistories.get(targetMarketId);
    if (!targetHistory || targetHistory.length < 5) {
        return [];
    }

    const correlations: CorrelationEdge[] = [];

    for (const [marketId, history] of allHistories) {
        if (marketId === targetMarketId) continue;
        if (history.length < 5) continue;

        const result = computeCorrelation(targetHistory, history);

        if (Math.abs(result.correlation) >= options.threshold && result.confidence > 0.3) {
            correlations.push({
                targetId: marketId,
                correlation: result.correlation,
                confidence: result.confidence,
                n: result.n,
            });
        }
    }

    // Sort by absolute correlation strength
    correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));

    return correlations.slice(0, options.maxResults);
}

/**
 * Find structural dependencies (markets in the same event).
 */
export function findStructuralDependencies(
    targetMarketId: string,
    events: ProcessedEvent[]
): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    // Find the event containing this market
    for (const event of events) {
        const targetMarket = event.markets.find((m) => m.id === targetMarketId);
        if (!targetMarket) continue;

        // Add all sibling markets as structurally dependent
        for (const market of event.markets) {
            if (market.id === targetMarketId) continue;

            edges.push({
                id: `${targetMarketId}-${market.id}`,
                sourceId: targetMarketId,
                targetId: market.id,
                type: 'structural',
                weight: 0.5, // Base weight for structural dependencies
                sharedEventId: event.id,
                sharedEventTitle: event.title,
                explanation: `Both markets are part of "${event.title}"`,
            });
        }

        break; // Found the event, no need to continue
    }

    return edges;
}

/**
 * Build correlation edges from correlation results.
 */
export function buildCorrelationEdges(
    sourceMarketId: string,
    correlations: CorrelationEdge[],
    timeWindow: TimeWindow
): DependencyEdge[] {
    return correlations.map((corr) => {
        const direction = corr.correlation > 0 ? 'positive' : 'negative';
        const strength = Math.abs(corr.correlation);

        return {
            id: `${sourceMarketId}-${corr.targetId}`,
            sourceId: sourceMarketId,
            targetId: corr.targetId,
            type: 'correlation' as const,
            weight: strength,
            correlation: corr.correlation,
            timeWindow,
            explanation: `${(corr.correlation * 100).toFixed(0)}% ${direction} correlation (${timeWindow}, n=${corr.n})`,
        };
    });
}

/**
 * Compute volatility for a market based on price history.
 * Returns a 0-1 value where higher means more volatile.
 */
export function computeVolatility(history: PriceHistoryPoint[]): number {
    if (history.length < 5) return 0;

    const prices = history.map((p) => p.price);
    const returns = computeReturns(prices);

    if (returns.length < 3) return 0;

    // Standard deviation of returns
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Normalize: typical stdDev for prediction markets is 0.01-0.1
    // Map to 0-1 range with 0.05 as "medium" volatility
    return Math.min(1, stdDev / 0.1);
}
