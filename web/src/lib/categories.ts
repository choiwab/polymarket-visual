import { RawPolymarketEvent } from './types';

// ============================================
// Category Classification
// ============================================

// Canonical category names
export const CATEGORIES = [
    'Politics',
    'Sports',
    'Crypto',
    'Entertainment',
    'Science',
    'Business',
    'Other',
] as const;

export type CategoryName = (typeof CATEGORIES)[number];

// Tag slug to category mapping (primary method)
const TAG_CATEGORY_MAP: Record<string, CategoryName> = {
    // Politics
    'politics': 'Politics',
    'us-politics': 'Politics',
    'elections': 'Politics',
    'election': 'Politics',
    'government': 'Politics',
    'congress': 'Politics',
    'senate': 'Politics',
    'trump': 'Politics',
    'biden': 'Politics',
    'president': 'Politics',
    'presidential': 'Politics',
    'democrat': 'Politics',
    'republican': 'Politics',
    'vote': 'Politics',
    'voting': 'Politics',
    'geopolitics': 'Politics',
    'world-politics': 'Politics',

    // Sports
    'sports': 'Sports',
    'nba': 'Sports',
    'nfl': 'Sports',
    'mlb': 'Sports',
    'nhl': 'Sports',
    'soccer': 'Sports',
    'football': 'Sports',
    'basketball': 'Sports',
    'baseball': 'Sports',
    'tennis': 'Sports',
    'golf': 'Sports',
    'mma': 'Sports',
    'ufc': 'Sports',
    'boxing': 'Sports',
    'f1': 'Sports',
    'formula-1': 'Sports',
    'world-cup': 'Sports',
    'olympics': 'Sports',
    'esports': 'Sports',

    // Crypto
    'crypto': 'Crypto',
    'cryptocurrency': 'Crypto',
    'bitcoin': 'Crypto',
    'btc': 'Crypto',
    'ethereum': 'Crypto',
    'eth': 'Crypto',
    'solana': 'Crypto',
    'sol': 'Crypto',
    'defi': 'Crypto',
    'nft': 'Crypto',
    'blockchain': 'Crypto',
    'web3': 'Crypto',
    'token': 'Crypto',

    // Entertainment
    'entertainment': 'Entertainment',
    'movies': 'Entertainment',
    'film': 'Entertainment',
    'tv': 'Entertainment',
    'television': 'Entertainment',
    'music': 'Entertainment',
    'celebrity': 'Entertainment',
    'oscars': 'Entertainment',
    'emmys': 'Entertainment',
    'grammys': 'Entertainment',
    'awards': 'Entertainment',
    'pop-culture': 'Entertainment',

    // Science
    'science': 'Science',
    'space': 'Science',
    'nasa': 'Science',
    'spacex': 'Science',
    'ai': 'Science',
    'artificial-intelligence': 'Science',
    'technology': 'Science',
    'tech': 'Science',
    'climate': 'Science',
    'weather': 'Science',
    'health': 'Science',
    'medicine': 'Science',

    // Business
    'business': 'Business',
    'economics': 'Business',
    'economy': 'Business',
    'markets': 'Business',
    'stocks': 'Business',
    'finance': 'Business',
    'fed': 'Business',
    'interest-rates': 'Business',
    'inflation': 'Business',
    'companies': 'Business',
};

// Keyword patterns for title-based fallback classification
const CATEGORY_KEYWORDS: Record<CategoryName, string[]> = {
    'Politics': [
        'election', 'president', 'vote', 'senate', 'congress', 'governor',
        'trump', 'biden', 'harris', 'republican', 'democrat', 'party',
        'poll', 'electoral', 'cabinet', 'impeach', 'legislation', 'bill',
        'supreme court', 'justice', 'nomination', 'primary', 'caucus',
    ],
    'Sports': [
        'win', 'championship', 'final', 'match', 'game', 'vs', 'vs.',
        'nba', 'nfl', 'mlb', 'nhl', 'ufc', 'afc', 'nfc',
        'super bowl', 'world series', 'playoffs', 'mvp', 'score',
        'team', 'player', 'coach', 'season', 'league', 'cup',
    ],
    'Crypto': [
        'bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'token',
        'blockchain', 'defi', 'nft', 'solana', 'sol', 'price',
        'market cap', 'altcoin', 'exchange', 'wallet', 'mining',
    ],
    'Entertainment': [
        'movie', 'film', 'actor', 'actress', 'director', 'oscar',
        'emmy', 'grammy', 'album', 'song', 'artist', 'celebrity',
        'netflix', 'disney', 'streaming', 'box office', 'premiere',
    ],
    'Science': [
        'ai', 'gpt', 'openai', 'spacex', 'nasa', 'launch', 'rocket',
        'climate', 'temperature', 'research', 'study', 'discovery',
        'virus', 'vaccine', 'fda', 'approval', 'trial',
    ],
    'Business': [
        'stock', 'market', 'fed', 'interest rate', 'inflation', 'gdp',
        'earnings', 'revenue', 'ipo', 'merger', 'acquisition', 'ceo',
        'company', 'corp', 'inc', 'recession', 'economic',
    ],
    'Other': [],
};

interface ClassificationResult {
    category: CategoryName;
    confidence: number;
}

/**
 * Classify an event into a category using hybrid approach:
 * 1. Use API categories if available
 * 2. Fall back to tag-based classification
 * 3. Final fallback to keyword matching on title
 */
export function classifyEvent(event: RawPolymarketEvent): ClassificationResult {
    // Method 1: Use API categories (highest confidence)
    if (event.categories && event.categories.length > 0) {
        const apiCategory = event.categories[0].label;
        // Map API category to our canonical names
        const normalized = normalizeCategory(apiCategory);
        if (normalized !== 'Other') {
            return { category: normalized, confidence: 0.95 };
        }
    }

    // Method 2: Use tags (high confidence)
    if (event.tags && event.tags.length > 0) {
        for (const tag of event.tags) {
            const slug = tag.slug.toLowerCase();
            if (TAG_CATEGORY_MAP[slug]) {
                return { category: TAG_CATEGORY_MAP[slug], confidence: 0.85 };
            }
            // Also check label
            const label = tag.label.toLowerCase();
            if (TAG_CATEGORY_MAP[label]) {
                return { category: TAG_CATEGORY_MAP[label], confidence: 0.85 };
            }
        }
    }

    // Method 3: Keyword matching on title (lower confidence)
    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const text = `${title} ${description}`;

    let bestMatch: CategoryName = 'Other';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (category === 'Other') continue;

        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword.toLowerCase())) {
                score++;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = category as CategoryName;
        }
    }

    if (bestScore > 0) {
        // Confidence based on number of keyword matches
        const confidence = Math.min(0.6 + bestScore * 0.1, 0.8);
        return { category: bestMatch, confidence };
    }

    // Default to Other
    return { category: 'Other', confidence: 0.2 };
}

/**
 * Normalize API category names to our canonical names
 */
function normalizeCategory(apiCategory: string): CategoryName {
    const lower = apiCategory.toLowerCase();

    // Direct matches
    if (lower.includes('politic')) return 'Politics';
    if (lower.includes('sport')) return 'Sports';
    if (lower.includes('crypto') || lower.includes('blockchain')) return 'Crypto';
    if (lower.includes('entertain') || lower.includes('culture')) return 'Entertainment';
    if (lower.includes('science') || lower.includes('tech')) return 'Science';
    if (lower.includes('business') || lower.includes('econom') || lower.includes('finance')) return 'Business';

    return 'Other';
}
