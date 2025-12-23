export interface MarketNode {
    id: string;
    question: string;
    volume: number; // Total volume
    volume24hr?: number; // Recent volume (delta)
    outcomeProb: number; // Probability of "Yes" (or primary outcome)
    group: string; // Category or Event title
    slug: string;
    image?: string;
}

export type MarketMapData = {
    name: string;
    children: MarketNode[];
};
