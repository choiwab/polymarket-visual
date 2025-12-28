import { DependencyEdge, MarketNode, ProcessedEvent } from './types';

/**
 * Entity types that can be extracted from market text
 */
export type EntityType = 'person' | 'company' | 'crypto' | 'country' | 'organization';

export interface ExtractedEntity {
    name: string;
    type: EntityType;
    normalized: string; // lowercase for matching
}

// ============================================================================
// Entity Dictionaries - Curated lists for reliable extraction
// ============================================================================

const POLITICAL_FIGURES: readonly string[] = [
    // US Politicians
    'Trump', 'Biden', 'Harris', 'DeSantis', 'Newsom', 'Obama', 'Pence',
    'RFK Jr', 'Robert Kennedy', 'Vivek', 'Ramaswamy', 'Haley', 'Nikki Haley',
    'AOC', 'Ocasio-Cortez', 'Pelosi', 'McConnell', 'Schumer', 'McCarthy',
    // Tech Leaders
    'Musk', 'Elon Musk', 'Zuckerberg', 'Bezos', 'Gates', 'Bill Gates',
    'Altman', 'Sam Altman', 'Satya Nadella', 'Tim Cook', 'Sundar Pichai',
    // World Leaders
    'Putin', 'Xi Jinping', 'Xi', 'Zelensky', 'Netanyahu', 'Modi',
    'Macron', 'Scholz', 'Trudeau', 'Lula', 'Milei', 'Kim Jong Un',
    // Sports/Entertainment
    'Taylor Swift', 'Beyonce', 'Drake', 'Kanye', 'Ye', 'LeBron',
    'Messi', 'Ronaldo', 'MrBeast',
];

const COMPANIES: readonly string[] = [
    // Big Tech
    'Apple', 'Google', 'Alphabet', 'Microsoft', 'Amazon', 'Tesla', 'Meta',
    'Nvidia', 'Netflix', 'Disney', 'Uber', 'Airbnb', 'Salesforce',
    // AI Companies
    'OpenAI', 'Anthropic', 'DeepMind', 'Midjourney', 'Stability AI',
    // Social/Media
    'Twitter', 'X Corp', 'TikTok', 'ByteDance', 'Reddit', 'Snap', 'Pinterest',
    'YouTube', 'Twitch', 'Spotify',
    // Space/Auto
    'SpaceX', 'Blue Origin', 'Virgin Galactic', 'Rivian', 'Lucid', 'Ford', 'GM',
    // Finance
    'Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'BlackRock', 'Citadel',
    'Robinhood', 'Coinbase', 'Binance', 'FTX', 'Stripe', 'Visa', 'Mastercard',
    // Pharma/Health
    'Pfizer', 'Moderna', 'Johnson & Johnson', 'Merck', 'Eli Lilly', 'Novo Nordisk',
];

const CRYPTO_ASSETS: readonly string[] = [
    // Major Cryptos
    'Bitcoin', 'BTC', 'Ethereum', 'ETH', 'Solana', 'SOL',
    'XRP', 'Ripple', 'Cardano', 'ADA', 'Polkadot', 'DOT',
    'Avalanche', 'AVAX', 'Polygon', 'MATIC', 'Chainlink', 'LINK',
    // Meme Coins
    'Dogecoin', 'DOGE', 'Shiba Inu', 'SHIB', 'Pepe', 'PEPE',
    // Stablecoins
    'Tether', 'USDT', 'USDC', 'DAI',
    // DeFi/NFT
    'Uniswap', 'UNI', 'Aave', 'OpenSea', 'Blur',
];

const COUNTRIES: readonly string[] = [
    'United States', 'US', 'USA', 'America',
    'China', 'Chinese', 'Russia', 'Russian', 'Ukraine', 'Ukrainian',
    'Israel', 'Israeli', 'Palestine', 'Palestinian', 'Gaza',
    'Iran', 'Iranian', 'North Korea', 'South Korea', 'Korea',
    'Taiwan', 'Japan', 'Japanese', 'India', 'Indian',
    'UK', 'Britain', 'British', 'Germany', 'German', 'France', 'French',
    'Brazil', 'Brazilian', 'Mexico', 'Mexican', 'Canada', 'Canadian',
    'Australia', 'Australian', 'Saudi Arabia', 'Saudi',
];

const ORGANIZATIONS: readonly string[] = [
    // US Government
    'Federal Reserve', 'Fed', 'Treasury', 'SEC', 'FDA', 'FTC', 'DOJ',
    'Supreme Court', 'SCOTUS', 'Congress', 'Senate', 'House',
    'White House', 'Pentagon', 'CIA', 'FBI', 'NSA',
    // International
    'ECB', 'Bank of England', 'NATO', 'UN', 'United Nations',
    'WHO', 'World Health Organization', 'IMF', 'World Bank',
    'EU', 'European Union', 'OPEC', 'WTO',
    // Other
    'NCAA', 'NFL', 'NBA', 'MLB', 'FIFA', 'UFC',
    'Academy Awards', 'Oscars', 'Grammy', 'Emmy',
];

// Create word boundary regex patterns for accurate matching
function createEntityMatcher(entities: readonly string[]): Map<string, { pattern: RegExp; name: string }> {
    const matchers = new Map<string, { pattern: RegExp; name: string }>();

    for (const entity of entities) {
        // Create case-insensitive word boundary pattern
        // Handle special characters in entity names
        const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
        const normalized = entity.toLowerCase();
        matchers.set(normalized, { pattern, name: entity });
    }

    return matchers;
}

// Pre-compile patterns for performance
const PERSON_MATCHERS = createEntityMatcher(POLITICAL_FIGURES);
const COMPANY_MATCHERS = createEntityMatcher(COMPANIES);
const CRYPTO_MATCHERS = createEntityMatcher(CRYPTO_ASSETS);
const COUNTRY_MATCHERS = createEntityMatcher(COUNTRIES);
const ORG_MATCHERS = createEntityMatcher(ORGANIZATIONS);

/**
 * Extract named entities from text using dictionary matching.
 * Uses word boundary matching to avoid partial matches.
 */
export function extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seen = new Set<string>(); // Avoid duplicates

    // Helper to add entities from a matcher
    const matchEntities = (
        matchers: Map<string, { pattern: RegExp; name: string }>,
        type: EntityType
    ) => {
        for (const [normalized, { pattern, name }] of matchers) {
            if (!seen.has(normalized) && pattern.test(text)) {
                seen.add(normalized);
                entities.push({ name, type, normalized });
            }
        }
    };

    // Match against all dictionaries
    matchEntities(PERSON_MATCHERS, 'person');
    matchEntities(COMPANY_MATCHERS, 'company');
    matchEntities(CRYPTO_MATCHERS, 'crypto');
    matchEntities(COUNTRY_MATCHERS, 'country');
    matchEntities(ORG_MATCHERS, 'organization');

    return entities;
}

/**
 * Find markets that share entities with the target market.
 * Returns edges connecting the target to markets with shared entities.
 */
export function findEntityBasedDependencies(
    targetMarketId: string,
    targetEntities: ExtractedEntity[],
    allMarkets: MarketNode[],
    events: ProcessedEvent[],
    options: { minSharedEntities: number }
): DependencyEdge[] {
    if (targetEntities.length === 0) return [];

    const edges: DependencyEdge[] = [];
    const targetNormalized = new Set(targetEntities.map(e => e.normalized));

    for (const market of allMarkets) {
        if (market.id === targetMarketId) continue;

        // Extract entities from market question and event title
        const marketEntities = extractEntities(market.question);
        const event = events.find(e => e.id === market.eventId);
        if (event) {
            marketEntities.push(...extractEntities(event.title));
        }

        // Find shared entities (by normalized name)
        const marketNormalized = new Set(marketEntities.map(e => e.normalized));
        const sharedNormalized = [...targetNormalized].filter(n => marketNormalized.has(n));

        if (sharedNormalized.length >= options.minSharedEntities) {
            // Get display names for shared entities
            const sharedNames = sharedNormalized.map(n => {
                const entity = targetEntities.find(e => e.normalized === n);
                return entity?.name || n;
            });

            // Weight: 0.3 per shared entity, capped at 1.0
            const weight = Math.min(1, sharedNormalized.length * 0.3);

            edges.push({
                id: `entity-${targetMarketId}-${market.id}`,
                sourceId: targetMarketId,
                targetId: market.id,
                type: 'entity',
                weight,
                sharedEntities: sharedNames,
                explanation: `Both mention: ${sharedNames.join(', ')}`,
            });
        }
    }

    // Sort by weight (most shared entities first)
    return edges.sort((a, b) => b.weight - a.weight);
}

/**
 * Get all unique entities across all markets.
 * Useful for debugging and analysis.
 */
export function getAllEntities(
    events: ProcessedEvent[]
): Map<string, { count: number; type: EntityType; markets: string[] }> {
    const entityStats = new Map<string, { count: number; type: EntityType; markets: string[] }>();

    for (const event of events) {
        const eventEntities = extractEntities(event.title);

        for (const market of event.markets) {
            const marketEntities = [...eventEntities, ...extractEntities(market.question)];

            for (const entity of marketEntities) {
                const existing = entityStats.get(entity.normalized);
                if (existing) {
                    existing.count++;
                    if (!existing.markets.includes(market.id)) {
                        existing.markets.push(market.id);
                    }
                } else {
                    entityStats.set(entity.normalized, {
                        count: 1,
                        type: entity.type,
                        markets: [market.id],
                    });
                }
            }
        }
    }

    return entityStats;
}
