import { MarketNode, RawPolymarketEvent, ProcessedEvent, PriceHistoryPoint, TimeWindow } from './types';
import { classifyEvent } from './categories';

const BASE_URL = '/api';

export async function fetchMarkets(): Promise<MarketNode[]> {
    try {
        // Fetch active markets with significant volume, sorted by volume descending
        const response = await fetch(
            `${BASE_URL}/markets?active=true&closed=false&order=-volume&limit=500&volume_min=5000`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch markets: ${response.statusText}`);
        }

        const data = await response.json();

        // The API returns a flat list of markets
        return data
            .filter((m: Record<string, unknown>) => {
                // basic filtering for binary markets (Yes/No) which are easiest to visualize clearly
                try {
                    const outcomes = JSON.parse((m.outcomes as string) || "[]");
                    return outcomes.length === 2;
                } catch {
                    return false;
                }
            })
            .map((m: Record<string, unknown>) => {
                let yesProb = 0;
                try {
                    const prices = JSON.parse((m.outcomePrices as string) || "[]");
                    yesProb = Number(prices[0] || 0);
                } catch {
                    yesProb = 0;
                }

                return {
                    id: m.id as string,
                    question: m.question as string,
                    volume: Number(m.volume || 0),
                    volume24hr: Number(m.volume_24h || 0),
                    outcomeProb: yesProb,
                    group: (m.groupItemTitle as string) || (m.category as string) || 'Other',
                    slug: m.slug as string,
                    eventSlug: (m.eventSlug as string) || (m.event_slug as string) || undefined,
                    image: (m.icon as string) || (m.image as string),
                };
            })
            .filter((node: MarketNode) => node.volume > 0);
    } catch (error) {
        console.error('Error fetching markets:', error);
        return [];
    }
}

// ============================================
// Events API
// ============================================

const EPSILON = 0.0001;

function computeHeat(volume24h: number, volumeTotal: number): number {
    if (volumeTotal <= 0) return 0;
    const ratio = volume24h / (volumeTotal + EPSILON);
    // Normalize: if 24h volume is 10% of total, that's "hot"
    return Math.min(Math.max(ratio * 10, 0), 1);
}

function parseMarketFromEvent(market: Record<string, unknown>, eventId: string, eventSlug: string): MarketNode | null {
    try {
        const outcomes = JSON.parse((market.outcomes as string) || '[]');
        // Only include binary markets
        if (outcomes.length !== 2) return null;

        const prices = JSON.parse((market.outcomePrices as string) || '[]');
        const yesProb = Number(prices[0] || 0);

        // Parse CLOB token IDs for price history API
        let clobTokenIds: string[] | undefined;
        try {
            const rawTokenIds = JSON.parse((market.clobTokenIds as string) || '[]');
            if (Array.isArray(rawTokenIds) && rawTokenIds.length > 0) {
                clobTokenIds = rawTokenIds;
            }
        } catch {
            // clobTokenIds not available
        }

        return {
            id: market.id as string,
            eventId,
            question: market.question as string,
            volume: Number(market.volume || 0),
            volume24hr: Number(market.volume24hr || 0),
            outcomeProb: yesProb,
            group: '',
            slug: market.slug as string,
            eventSlug,
            image: (market.image as string) || (market.icon as string),
            liquidity: Number(market.liquidity || 0),
            endTime: market.endDate as string,
            endDate: market.endDate as string,
            clobTokenIds,
        };
    } catch {
        return null;
    }
}

export async function fetchEvents(): Promise<ProcessedEvent[]> {
    try {
        const response = await fetch(
            `${BASE_URL}/events?active=true&closed=false&order=-volume&limit=200&volume_min=10000`
        );

        if (!response.ok) {
            throw new Error(`Failed to fetch events: ${response.statusText}`);
        }

        const data: RawPolymarketEvent[] = await response.json();

        return data
            .map((event): ProcessedEvent | null => {
                // Parse embedded markets
                const markets: MarketNode[] = (event.markets || [])
                    .map((m) => parseMarketFromEvent(m as unknown as Record<string, unknown>, event.id, event.slug))
                    .filter((m): m is MarketNode => m !== null && m.volume > 0);

                if (markets.length === 0) return null;

                const volumeTotal = Number(event.volume || 0);
                const volume24h = Number(event.volume24hr || 0);

                // Classify into category
                const { category, confidence } = classifyEvent(event);

                return {
                    id: event.id,
                    categoryId: category.toLowerCase().replace(/\s+/g, '-'),
                    title: event.title,
                    slug: event.slug,
                    description: event.description,
                    volumeTotal,
                    volume24h,
                    volumeHeat: computeHeat(volume24h, volumeTotal),
                    liquidity: Number(event.liquidity || 0),
                    endDate: event.endDate,
                    confidence,
                    marketCount: markets.length,
                    markets,
                    image: event.image,
                };
            })
            .filter((e): e is ProcessedEvent => e !== null && e.volumeTotal > 0);
    } catch (error) {
        console.error('Error fetching events:', error);
        return [];
    }
}

// ============================================
// Price History API
// ============================================

interface RawPriceHistoryPoint {
    t: number; // timestamp in seconds
    p: number; // price as number
}

// Map TimeWindow to CLOB API interval format
function getApiInterval(window: TimeWindow): string {
    const intervals = {
        '1h': '1h',
        '24h': '1d',
        '7d': '1w',
    };
    return intervals[window];
}

function getFidelityMinutes(window: TimeWindow): number {
    // Fidelity determines data granularity
    const fidelity = {
        '1h': 1,    // 1 minute intervals for 1h window
        '24h': 15,  // 15 minute intervals for 24h window
        '7d': 60,   // 1 hour intervals for 7d window
    };
    return fidelity[window];
}

export async function fetchPriceHistory(
    tokenId: string,
    timeWindow: TimeWindow = '24h'
): Promise<PriceHistoryPoint[]> {
    try {
        const interval = getApiInterval(timeWindow);
        const fidelity = getFidelityMinutes(timeWindow);

        const response = await fetch(
            `${BASE_URL}/prices-history?token=${tokenId}&interval=${interval}&fidelity=${fidelity}`
        );

        if (!response.ok) {
            // Expected for some tokens — don't use console.error
            console.warn(`Price history unavailable for token ${tokenId.slice(0, 12)}… (${response.status})`);
            return [];
        }

        const data = await response.json();

        // Handle various response formats
        const history: RawPriceHistoryPoint[] = Array.isArray(data) ? data : (data.history || []);

        return history.map((point) => ({
            timestamp: point.t * 1000, // Convert seconds to ms
            price: typeof point.p === 'number' ? point.p : parseFloat(String(point.p)) || 0,
        }));
    } catch (error) {
        console.warn('Price history fetch failed:', (error as Error).message);
        return [];
    }
}

const BATCH_SIZE = 5;

export async function fetchMultiplePriceHistories(
    tokenIds: string[],
    interval: TimeWindow = '24h'
): Promise<Map<string, PriceHistoryPoint[]>> {
    const results = new Map<string, PriceHistoryPoint[]>();

    // Process in batches to avoid overwhelming the API
    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
        const batch = tokenIds.slice(i, i + BATCH_SIZE);

        const settled = await Promise.allSettled(
            batch.map(async (tokenId) => {
                const history = await fetchPriceHistory(tokenId, interval);
                return { tokenId, history };
            })
        );

        for (const result of settled) {
            if (result.status === 'fulfilled') {
                results.set(result.value.tokenId, result.value.history);
            }
        }
    }

    return results;
}
