// ============================================
// View State Types
// ============================================

export type ViewLevel = 'category' | 'event' | 'market';

export interface ViewState {
    level: ViewLevel;
    selectedCategoryId?: string;
    selectedCategoryName?: string;
    selectedEventId?: string;
    selectedEventTitle?: string;
}

// ============================================
// Category Types
// ============================================

export interface Category {
    id: string;
    name: string;
    volumeTotal: number;
    volume24h: number;
    volumeHeat: number; // 0-1 normalized heat metric
    confidence: number; // Classification confidence
    eventCount: number;
    events: ProcessedEvent[];
}

// ============================================
// Event Types
// ============================================

export interface ProcessedEvent {
    id: string;
    categoryId: string;
    title: string;
    slug: string;
    description?: string;
    volumeTotal: number;
    volume24h: number;
    volumeHeat: number; // 0-1 normalized heat metric
    liquidity: number;
    endDate?: string;
    confidence: number; // Classification confidence
    marketCount: number;
    markets: MarketNode[];
    image?: string;
}

// Raw API response types
export interface RawPolymarketEvent {
    id: string;
    title: string;
    slug: string;
    description?: string;
    volume: string;
    volume24hr?: string;
    liquidity?: string;
    endDate?: string;
    image?: string;
    active?: boolean;
    closed?: boolean;
    markets?: RawPolymarketMarket[];
    tags?: Array<{ id: number; label: string; slug: string }>;
    categories?: Array<{ id: number; label: string; slug: string; parentCategory?: string }>;
}

export interface RawPolymarketMarket {
    id: string;
    question: string;
    slug: string;
    conditionId?: string;
    outcomes?: string; // JSON string array
    outcomePrices?: string; // JSON string array
    volume?: string;
    volume24hr?: string;
    liquidity?: string;
    endDate?: string;
    image?: string;
    icon?: string;
}

// ============================================
// Market Types
// ============================================

export interface MarketNode {
    id: string;
    eventId?: string;
    question: string;
    volume: number;
    volume24hr?: number;
    outcomeProb: number; // Probability of "Yes" (0-1)
    group: string; // Category or Event title (legacy)
    slug: string;
    image?: string;
    liquidity?: number;
    endTime?: string;
}

export type MarketMapData = {
    name: string;
    children: MarketNode[];
};

// ============================================
// Treemap Node Types (for HeatMap component)
// ============================================

export interface TreemapNode {
    id: string;
    name: string;
    value: number; // Used for sizing (volume)
    heat: number; // 0-1 for coloring
    slug?: string;
    metadata?: Record<string, unknown>;
}
