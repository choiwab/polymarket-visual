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
    clobTokenIds?: string; // JSON string array of token IDs for CLOB API
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
    outcomeProb: number; // Probability of "Yes" or highest outcome (0-1)
    group: string; // Category or Event title (legacy)
    slug: string;
    eventSlug?: string;
    image?: string;
    liquidity?: number;
    endTime?: string;
    endDate?: string; // ISO date string for resolution date
    // Multi-choice market support
    outcomes?: string[]; // ["Trump", "Biden", "Other"]
    outcomePrices?: number[]; // [0.45, 0.40, 0.15]
    isMultiChoice?: boolean; // true if outcomes.length > 2
    // CLOB token IDs for price history API
    clobTokenIds?: string[]; // [YES_token, NO_token]
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

// ============================================
// Geographic Types (for World Map)
// ============================================

export type LocationType = 'point' | 'regional' | 'global';

export interface GeoCoordinates {
    lat: number;
    lng: number;
}

export interface GeoLocation {
    type: LocationType;
    coordinates: GeoCoordinates;
    country?: string; // ISO alpha-2 (e.g., 'US', 'GB')
    countryName?: string; // Full name (e.g., 'United States')
    cityName?: string; // City name if resolved (e.g., 'New York')
    confidence: number; // 0-1
    source: 'title' | 'description' | 'institution' | 'default';
}

export interface GeoEnrichedEvent extends ProcessedEvent {
    geoLocation: GeoLocation;
}

// ============================================
// Tab Navigation Types
// ============================================

export type TabId = 'heatmap' | 'worldmap' | 'dependency';

// ============================================
// Dependency Map Types
// ============================================

export type DependencyType = 'structural' | 'correlation' | 'entity' | 'temporal';

export type TimeWindow = '1h' | '24h' | '7d';

export interface PriceHistoryPoint {
    timestamp: number; // Unix ms
    price: number; // 0-1
}

export interface DependencyEdge {
    id: string; // `${sourceId}-${targetId}`
    sourceId: string;
    targetId: string;
    type: DependencyType;
    weight: number; // 0-1 normalized strength
    // Correlation-specific
    correlation?: number; // -1 to 1
    timeWindow?: TimeWindow;
    // Structural-specific
    sharedEventId?: string;
    sharedEventTitle?: string;
    // Entity-specific
    sharedEntities?: string[]; // Names of shared entities
    // Temporal-specific
    daysDiff?: number; // Days between resolution dates
    precedence?: 'before' | 'after' | 'same'; // Target resolves before/after source
    // For display
    explanation?: string;
}

export interface DependencyNode {
    id: string;
    marketId: string;
    eventId: string;
    eventTitle: string;
    question: string;
    volume: number;
    volume24hr: number;
    outcomeProb: number;
    categoryId: string;
    categoryName: string;
    slug: string;
    eventSlug?: string;
    // Graph layout (mutable by d3-force)
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null; // Fixed position (for ego center)
    fy?: number | null;
    // Visual encoding
    volatility?: number; // 0-1 for border glow
}

export interface DependencyGraph {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
    centerNodeId: string;
}

export interface DependencyMapFilters {
    correlationThreshold: number; // 0-1, default 0.6
    timeWindow: TimeWindow;
    dependencyType: 'all' | 'structural' | 'correlation' | 'entity' | 'temporal';
    showCrossEvent: boolean; // false = same event only
    maxEdges: number; // default 5
    minSharedEntities: number; // default 1, for entity type
    maxDaysDiff: number; // default 14, for temporal type
}

// ============================================
// Panel State Types
// ============================================

export interface PanelState {
    isOpen: boolean;
    eventId?: string;
}

export interface ClusterPanelState {
    isOpen: boolean;
    events: GeoEnrichedEvent[];
}

// ============================================
// Cluster Marker Types (for WorldMap)
// ============================================

export interface ClusterMarker {
    id: string; // "cluster-{lng},{lat}"
    key: string; // "{lng},{lat}" for matching
    coordinates: [number, number]; // [lng, lat]
    events: GeoEnrichedEvent[];
    size: number; // Pixel radius based on total volume
    color: string; // Based on max heat
    opacity: number; // Based on avg confidence
    count: number; // Number of events
    countryName?: string;
    cityName?: string;
}
