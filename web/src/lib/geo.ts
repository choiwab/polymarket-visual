import { ProcessedEvent, GeoLocation } from './types';

// ============================================
// Country Centroids (ISO alpha-2 -> coordinates)
// ============================================

interface CountryData {
    lat: number;
    lng: number;
    name: string;
}

export const COUNTRY_CENTROIDS: Record<string, CountryData> = {
    // North America
    US: { lat: 38.8951, lng: -77.0364, name: 'United States' },
    CA: { lat: 45.4215, lng: -75.6972, name: 'Canada' },
    MX: { lat: 19.4326, lng: -99.1332, name: 'Mexico' },

    // Europe
    GB: { lat: 51.5074, lng: -0.1278, name: 'United Kingdom' },
    DE: { lat: 52.52, lng: 13.405, name: 'Germany' },
    FR: { lat: 48.8566, lng: 2.3522, name: 'France' },
    IT: { lat: 41.9028, lng: 12.4964, name: 'Italy' },
    ES: { lat: 40.4168, lng: -3.7038, name: 'Spain' },
    NL: { lat: 52.3676, lng: 4.9041, name: 'Netherlands' },
    PL: { lat: 52.2297, lng: 21.0122, name: 'Poland' },
    UA: { lat: 50.4501, lng: 30.5234, name: 'Ukraine' },
    SE: { lat: 59.3293, lng: 18.0686, name: 'Sweden' },
    NO: { lat: 59.9139, lng: 10.7522, name: 'Norway' },
    CH: { lat: 46.9481, lng: 7.4474, name: 'Switzerland' },
    AT: { lat: 48.2082, lng: 16.3738, name: 'Austria' },
    BE: { lat: 50.8503, lng: 4.3517, name: 'Belgium' },
    PT: { lat: 38.7223, lng: -9.1393, name: 'Portugal' },
    GR: { lat: 37.9838, lng: 23.7275, name: 'Greece' },
    IE: { lat: 53.3498, lng: -6.2603, name: 'Ireland' },
    FI: { lat: 60.1699, lng: 24.9384, name: 'Finland' },
    DK: { lat: 55.6761, lng: 12.5683, name: 'Denmark' },

    // Eastern Europe & Russia
    RU: { lat: 55.7558, lng: 37.6173, name: 'Russia' },
    BY: { lat: 53.9045, lng: 27.559, name: 'Belarus' },

    // Middle East
    IL: { lat: 31.7683, lng: 35.2137, name: 'Israel' },
    PS: { lat: 31.9522, lng: 35.2332, name: 'Palestine' },
    IR: { lat: 35.6892, lng: 51.389, name: 'Iran' },
    SA: { lat: 24.7136, lng: 46.6753, name: 'Saudi Arabia' },
    AE: { lat: 25.2048, lng: 55.2708, name: 'United Arab Emirates' },
    TR: { lat: 39.9334, lng: 32.8597, name: 'Turkey' },
    SY: { lat: 33.5138, lng: 36.2765, name: 'Syria' },
    IQ: { lat: 33.3152, lng: 44.3661, name: 'Iraq' },
    LB: { lat: 33.8938, lng: 35.5018, name: 'Lebanon' },
    JO: { lat: 31.9454, lng: 35.9284, name: 'Jordan' },
    YE: { lat: 15.3694, lng: 44.191, name: 'Yemen' },

    // Asia
    CN: { lat: 39.9042, lng: 116.4074, name: 'China' },
    JP: { lat: 35.6762, lng: 139.6503, name: 'Japan' },
    KR: { lat: 37.5665, lng: 126.978, name: 'South Korea' },
    KP: { lat: 39.0392, lng: 125.7625, name: 'North Korea' },
    IN: { lat: 28.6139, lng: 77.209, name: 'India' },
    PK: { lat: 33.6844, lng: 73.0479, name: 'Pakistan' },
    TW: { lat: 25.033, lng: 121.5654, name: 'Taiwan' },
    TH: { lat: 13.7563, lng: 100.5018, name: 'Thailand' },
    VN: { lat: 21.0278, lng: 105.8342, name: 'Vietnam' },
    SG: { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    MY: { lat: 3.139, lng: 101.6869, name: 'Malaysia' },
    ID: { lat: -6.2088, lng: 106.8456, name: 'Indonesia' },
    PH: { lat: 14.5995, lng: 120.9842, name: 'Philippines' },
    BD: { lat: 23.8103, lng: 90.4125, name: 'Bangladesh' },
    AF: { lat: 34.5553, lng: 69.2075, name: 'Afghanistan' },

    // Oceania
    AU: { lat: -35.2809, lng: 149.13, name: 'Australia' },
    NZ: { lat: -41.2865, lng: 174.7762, name: 'New Zealand' },

    // South America
    BR: { lat: -15.7801, lng: -47.9292, name: 'Brazil' },
    AR: { lat: -34.6037, lng: -58.3816, name: 'Argentina' },
    CO: { lat: 4.711, lng: -74.0721, name: 'Colombia' },
    CL: { lat: -33.4489, lng: -70.6693, name: 'Chile' },
    VE: { lat: 10.4806, lng: -66.9036, name: 'Venezuela' },
    PE: { lat: -12.0464, lng: -77.0428, name: 'Peru' },

    // Africa
    ZA: { lat: -25.7479, lng: 28.2293, name: 'South Africa' },
    EG: { lat: 30.0444, lng: 31.2357, name: 'Egypt' },
    NG: { lat: 9.0765, lng: 7.3986, name: 'Nigeria' },
    KE: { lat: -1.2921, lng: 36.8219, name: 'Kenya' },
    ET: { lat: 9.145, lng: 40.4897, name: 'Ethiopia' },
};

// ============================================
// City Coordinates (for sub-country spreading)
// ============================================

const CITY_COORDINATES: Record<string, { lat: number; lng: number; country: string }> = {
    // US
    'new york': { lat: 40.7128, lng: -74.006, country: 'US' },
    'california': { lat: 36.7783, lng: -119.4179, country: 'US' },
    'texas': { lat: 31.9686, lng: -99.9018, country: 'US' },
    'florida': { lat: 27.6648, lng: -81.5158, country: 'US' },
    'washington': { lat: 38.8951, lng: -77.0364, country: 'US' },
    'chicago': { lat: 41.8781, lng: -87.6298, country: 'US' },
    'los angeles': { lat: 34.0522, lng: -118.2437, country: 'US' },
    'san francisco': { lat: 37.7749, lng: -122.4194, country: 'US' },
    'silicon valley': { lat: 37.3875, lng: -122.0575, country: 'US' },
    // GB
    'london': { lat: 51.5074, lng: -0.1278, country: 'GB' },
    'scotland': { lat: 56.4907, lng: -4.2026, country: 'GB' },
    'manchester': { lat: 53.4808, lng: -2.2426, country: 'GB' },
    // DE
    'berlin': { lat: 52.52, lng: 13.405, country: 'DE' },
    'munich': { lat: 48.1351, lng: 11.582, country: 'DE' },
    // FR
    'paris': { lat: 48.8566, lng: 2.3522, country: 'FR' },
    // RU
    'moscow': { lat: 55.7558, lng: 37.6173, country: 'RU' },
    // CN
    'beijing': { lat: 39.9042, lng: 116.4074, country: 'CN' },
    'shanghai': { lat: 31.2304, lng: 121.4737, country: 'CN' },
    'hong kong': { lat: 22.3193, lng: 114.1694, country: 'CN' },
    // JP
    'tokyo': { lat: 35.6762, lng: 139.6503, country: 'JP' },
    // KR
    'seoul': { lat: 37.5665, lng: 126.978, country: 'KR' },
    // IN
    'delhi': { lat: 28.6139, lng: 77.209, country: 'IN' },
    'mumbai': { lat: 19.076, lng: 72.8777, country: 'IN' },
    // IL
    'jerusalem': { lat: 31.7683, lng: 35.2137, country: 'IL' },
    'tel aviv': { lat: 32.0853, lng: 34.7818, country: 'IL' },
    // PS
    'gaza': { lat: 31.3547, lng: 34.3088, country: 'PS' },
    'ramallah': { lat: 31.9038, lng: 35.2034, country: 'PS' },
    // TR
    'ankara': { lat: 39.9334, lng: 32.8597, country: 'TR' },
    'istanbul': { lat: 41.0082, lng: 28.9784, country: 'TR' },
    // AU
    'sydney': { lat: -33.8688, lng: 151.2093, country: 'AU' },
    'melbourne': { lat: -37.8136, lng: 144.9631, country: 'AU' },
    // BR
    'sao paulo': { lat: -23.5505, lng: -46.6333, country: 'BR' },
    // UA
    'kyiv': { lat: 50.4501, lng: 30.5234, country: 'UA' },
    'kiev': { lat: 50.4501, lng: 30.5234, country: 'UA' },
    'crimea': { lat: 44.9521, lng: 34.1024, country: 'UA' },
    'donbas': { lat: 48.0159, lng: 37.8028, country: 'UA' },
    // CH
    'zurich': { lat: 47.3769, lng: 8.5417, country: 'CH' },
    'geneva': { lat: 46.2044, lng: 6.1432, country: 'CH' },
    'davos': { lat: 46.8003, lng: 9.8361, country: 'CH' },
    // IT
    'rome': { lat: 41.9028, lng: 12.4964, country: 'IT' },
    'milan': { lat: 45.4642, lng: 9.19, country: 'IT' },
    // ES
    'madrid': { lat: 40.4168, lng: -3.7038, country: 'ES' },
    'barcelona': { lat: 41.3874, lng: 2.1686, country: 'ES' },
};

function matchCity(text: string, countryCode?: string): { lat: number; lng: number; country: string; name: string } | null {
    for (const [cityName, coords] of Object.entries(CITY_COORDINATES)) {
        if (countryCode && coords.country !== countryCode) continue;
        const regex = new RegExp(`\\b${cityName}\\b`, 'i');
        if (regex.test(text)) {
            // Capitalize city name for display
            const name = cityName.replace(/\b\w/g, (c) => c.toUpperCase());
            return { ...coords, name };
        }
    }
    return null;
}

// ============================================
// Institution to Country Mapping (Tier 1)
// ============================================

const INSTITUTION_LOCATION_MAP: Record<string, string> = {
    // Central Banks
    'federal reserve': 'US',
    'the fed': 'US',
    'fed': 'US',
    'fomc': 'US',
    'ecb': 'DE',
    'european central bank': 'DE',
    'bank of england': 'GB',
    'boe': 'GB',
    'bank of japan': 'JP',
    'boj': 'JP',
    'pboc': 'CN',
    'rbi': 'IN',
    'snb': 'CH',

    // US Government
    'congress': 'US',
    'senate': 'US',
    'supreme court': 'US',
    'white house': 'US',
    'pentagon': 'US',
    'cia': 'US',
    'fbi': 'US',
    'sec': 'US',
    'ftc': 'US',
    'doj': 'US',

    // International Organizations
    'un': 'US', // NYC headquarters
    'united nations': 'US',
    'nato': 'BE',
    'eu': 'BE',
    'european union': 'BE',
    'imf': 'US',
    'world bank': 'US',
    'wto': 'CH',

    // US Sports Leagues
    'nfl': 'US',
    'nba': 'US',
    'mlb': 'US',
    'nhl': 'US',
    'mls': 'US',
    'ncaa': 'US',
    'super bowl': 'US',
    'world series': 'US',
    'march madness': 'US',

    // European Sports
    'premier league': 'GB',
    'bundesliga': 'DE',
    'la liga': 'ES',
    'serie a': 'IT',
    'ligue 1': 'FR',
    'champions league': 'CH',
    'europa league': 'CH',
    'uefa': 'CH',
    'fifa': 'CH',

    // Tech Companies
    'openai': 'US',
    'anthropic': 'US',
    'meta': 'US',
    'facebook': 'US',
    'google': 'US',
    'alphabet': 'US',
    'apple': 'US',
    'microsoft': 'US',
    'amazon': 'US',
    'nvidia': 'US',
    'tesla': 'US',
    'spacex': 'US',
    'twitter': 'US',
    'x corp': 'US',
    'netflix': 'US',
    'disney': 'US',
    'tiktok': 'CN',
    'bytedance': 'CN',
    'alibaba': 'CN',
    'tencent': 'CN',
};

// ============================================
// Country Keywords (Tier 2)
// ============================================

const COUNTRY_KEYWORDS: Record<string, string[]> = {
    US: [
        'united states',
        'america',
        'american',
        'u.s.',
        'usa',
        'trump',
        'biden',
        'harris',
        'desantis',
        'pence',
        'vance',
        'newsom',
        'california',
        'new york',
        'texas',
        'florida',
        'washington',
        'democrat',
        'republican',
        'gop',
        'dnc',
        'rnc',
        'electoral college',
        'midterm',
        'inauguration',
        'oval office',
    ],
    GB: [
        'united kingdom',
        'britain',
        'british',
        'uk',
        'england',
        'english',
        'london',
        'scotland',
        'wales',
        'starmer',
        'sunak',
        'truss',
        'tory',
        'labour',
        'conservative',
        'downing street',
        'westminster',
        'brexit',
    ],
    DE: [
        'germany',
        'german',
        'berlin',
        'munich',
        'scholz',
        'merkel',
        'bundestag',
        'bundesbank',
    ],
    FR: [
        'france',
        'french',
        'paris',
        'macron',
        'le pen',
        'melenchon',
        'elysee',
    ],
    RU: [
        'russia',
        'russian',
        'moscow',
        'putin',
        'kremlin',
        'medvedev',
        'lavrov',
    ],
    UA: [
        'ukraine',
        'ukrainian',
        'kyiv',
        'kiev',
        'zelensky',
        'zelenskyy',
        'donbas',
        'crimea',
    ],
    CN: [
        'china',
        'chinese',
        'beijing',
        'shanghai',
        'xi jinping',
        'ccp',
        'prc',
        'communist party',
        'hong kong',
    ],
    TW: ['taiwan', 'taiwanese', 'taipei', 'tsai'],
    JP: ['japan', 'japanese', 'tokyo', 'kishida', 'abe'],
    KR: ['south korea', 'korean', 'seoul', 'yoon'],
    KP: ['north korea', 'pyongyang', 'kim jong'],
    IN: ['india', 'indian', 'delhi', 'mumbai', 'modi', 'gandhi'],
    IL: ['israel', 'israeli', 'jerusalem', 'tel aviv', 'netanyahu', 'idf'],
    PS: ['palestine', 'palestinian', 'gaza', 'hamas', 'west bank', 'ramallah'],
    IR: ['iran', 'iranian', 'tehran', 'khamenei', 'irgc', 'persian'],
    SA: [
        'saudi arabia',
        'saudi',
        'riyadh',
        'mbs',
        'bin salman',
        'aramco',
        'opec',
    ],
    TR: ['turkey', 'turkish', 'ankara', 'istanbul', 'erdogan'],
    AU: ['australia', 'australian', 'sydney', 'melbourne', 'canberra'],
    BR: ['brazil', 'brazilian', 'brasilia', 'sao paulo', 'lula', 'bolsonaro'],
    AR: ['argentina', 'argentine', 'buenos aires', 'milei'],
    MX: ['mexico', 'mexican', 'mexico city', 'amlo', 'obrador', 'sheinbaum'],
    CA: ['canada', 'canadian', 'ottawa', 'toronto', 'trudeau', 'poilievre'],
    EG: ['egypt', 'egyptian', 'cairo', 'sisi'],
    ZA: ['south africa', 'johannesburg', 'cape town', 'ramaphosa'],
    VE: ['venezuela', 'venezuelan', 'caracas', 'maduro'],
    PL: ['poland', 'polish', 'warsaw', 'tusk', 'duda'],
    NL: ['netherlands', 'dutch', 'amsterdam', 'wilders'],
    IT: ['italy', 'italian', 'rome', 'milan', 'meloni', 'draghi'],
    ES: ['spain', 'spanish', 'madrid', 'barcelona', 'sanchez'],
    SE: ['sweden', 'swedish', 'stockholm'],
    CH: ['switzerland', 'swiss', 'zurich', 'geneva', 'davos'],
};

// ============================================
// Global Event Keywords (Tier 3)
// ============================================

const GLOBAL_KEYWORDS: string[] = [
    'bitcoin',
    'btc',
    'ethereum',
    'eth',
    'crypto',
    'cryptocurrency',
    'solana',
    'xrp',
    'dogecoin',
    'defi',
    'nft',
    'web3',
    'blockchain',
    'ai',
    'artificial intelligence',
    'gpt',
    'chatgpt',
    'claude',
    'gemini',
    'llm',
    'agi',
    'climate',
    'global warming',
    'carbon',
    'world',
    'international',
    'global',
    'worldwide',
    'pandemic',
    'who',
];

// ============================================
// Regional Keywords (for future regional overlays)
// ============================================

const REGION_KEYWORDS: Record<string, { keywords: string[]; center: { lat: number; lng: number } }> = {
    'middle-east': {
        keywords: ['middle east', 'mideast', 'gulf', 'levant', 'arab'],
        center: { lat: 29.0, lng: 41.0 },
    },
    europe: {
        keywords: ['europe', 'european', 'eurozone'],
        center: { lat: 50.0, lng: 10.0 },
    },
    'asia-pacific': {
        keywords: ['asia pacific', 'apac', 'indo-pacific'],
        center: { lat: 25.0, lng: 120.0 },
    },
};

// ============================================
// Inference Function
// ============================================

export interface GeoInferenceResult {
    geoLocation: GeoLocation;
}

export function inferEventLocation(event: ProcessedEvent): GeoInferenceResult {
    const title = event.title.toLowerCase();
    const description = (event.description || '').toLowerCase();
    const text = `${title} ${description}`;

    // Tier 1: Institution matching (highest confidence: 0.9)
    // Use word boundary matching to avoid false positives (e.g., "un" matching in "under")
    for (const [institution, countryCode] of Object.entries(
        INSTITUTION_LOCATION_MAP
    )) {
        const regex = new RegExp(`\\b${institution}\\b`, 'i');
        if (regex.test(text)) {
            const country = COUNTRY_CENTROIDS[countryCode];
            if (country) {
                const city = matchCity(text, countryCode);
                const coords = city || { lat: country.lat, lng: country.lng };
                return {
                    geoLocation: {
                        type: 'point',
                        coordinates: coords,
                        country: countryCode,
                        countryName: country.name,
                        cityName: city?.name,
                        confidence: 0.9,
                        source: regex.test(title)
                            ? 'title'
                            : 'institution',
                    },
                };
            }
        }
    }

    // Tier 2: Country keyword matching (confidence: 0.5-0.85)
    // Use word boundary matching to avoid false positives
    let bestMatch: { code: string; score: number } | null = null;

    for (const [countryCode, keywords] of Object.entries(COUNTRY_KEYWORDS)) {
        let score = 0;
        for (const keyword of keywords) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'i');
            if (regex.test(text)) {
                // Title matches weighted higher
                score += regex.test(title) ? 2 : 1;
            }
        }
        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { code: countryCode, score };
        }
    }

    if (bestMatch) {
        const country = COUNTRY_CENTROIDS[bestMatch.code];
        if (country) {
            const confidence = Math.min(0.5 + bestMatch.score * 0.1, 0.85);
            const city = matchCity(text, bestMatch.code);
            const coords = city || { lat: country.lat, lng: country.lng };
            return {
                geoLocation: {
                    type: 'point',
                    coordinates: coords,
                    country: bestMatch.code,
                    countryName: country.name,
                    cityName: city?.name,
                    confidence,
                    source: 'title',
                },
            };
        }
    }

    // Tier 2.5: Regional matching (for future use)
    for (const [, regionData] of Object.entries(REGION_KEYWORDS)) {
        for (const keyword of regionData.keywords) {
            if (text.includes(keyword)) {
                return {
                    geoLocation: {
                        type: 'regional',
                        coordinates: regionData.center,
                        confidence: 0.6,
                        source: 'title',
                    },
                };
            }
        }
    }

    // Tier 3: Global keywords (type: 'global', confidence: 0.7)
    for (const keyword of GLOBAL_KEYWORDS) {
        if (text.includes(keyword)) {
            return {
                geoLocation: {
                    type: 'global',
                    coordinates: { lat: 0, lng: 0 },
                    confidence: 0.7,
                    source: 'title',
                },
            };
        }
    }

    // Default: Mark as global with low confidence
    return {
        geoLocation: {
            type: 'global',
            coordinates: { lat: 0, lng: 0 },
            confidence: 0.2,
            source: 'default',
        },
    };
}
