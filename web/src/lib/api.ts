import { MarketNode } from './types';

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
            .filter((m: any) => {
                // basic filtering for binary markets (Yes/No) which are easiest to visualize clearly
                try {
                    const outcomes = JSON.parse(m.outcomes || "[]");
                    return outcomes.length === 2;
                } catch (e) {
                    return false;
                }
            })
            .map((m: any) => {
                let yesProb = 0;
                try {
                    const prices = JSON.parse(m.outcomePrices || "[]");
                    yesProb = Number(prices[0] || 0);
                } catch (e) {
                    yesProb = 0;
                }

                return {
                    id: m.id,
                    question: m.question,
                    volume: Number(m.volume || 0),
                    volume24hr: Number(m.volume_24h || 0),
                    outcomeProb: yesProb,
                    group: m.groupItemTitle || m.category || 'Other',
                    slug: m.slug,
                    image: m.icon || m.image,
                };
            })
            .filter((node: MarketNode) => node.volume > 0);
    } catch (error) {
        console.error('Error fetching markets:', error);
        return [];
    }
}
