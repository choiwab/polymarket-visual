import { GeoEnrichedEvent } from './types';

// ============================================
// Types
// ============================================

export interface LocationGroup {
    key: string; // "lng,lat" string key
    coordinates: [number, number]; // [lng, lat]
    events: GeoEnrichedEvent[];
    totalVolume: number;
    maxHeat: number;
    avgConfidence: number;
    countryName?: string;
    cityName?: string;
}

export interface GroupedMarkerData {
    groups: LocationGroup[];
    singleEvents: GeoEnrichedEvent[];
}

export interface ExpandedPosition {
    event: GeoEnrichedEvent;
    offset: { x: number; y: number };
    angle: number;
}

// ============================================
// Grouping Function
// ============================================

/**
 * Groups events by their coordinates to identify overlapping markers.
 * Events at the same location (within precision) are grouped together.
 *
 * @param events - Array of geo-enriched events
 * @param precision - Decimal places for coordinate comparison (default: 4)
 * @returns Object with groups (2+ events) and singleEvents (unique locations)
 */
export function groupEventsByLocation(
    events: GeoEnrichedEvent[],
    precision: number = 4
): GroupedMarkerData {
    const locationMap = new Map<string, GeoEnrichedEvent[]>();

    events.forEach((event) => {
        // Round coordinates to avoid floating point comparison issues
        const lng = event.geoLocation.coordinates.lng.toFixed(precision);
        const lat = event.geoLocation.coordinates.lat.toFixed(precision);
        const key = `${lng},${lat}`;

        if (!locationMap.has(key)) {
            locationMap.set(key, []);
        }
        locationMap.get(key)!.push(event);
    });

    const groups: LocationGroup[] = [];
    const singleEvents: GeoEnrichedEvent[] = [];

    locationMap.forEach((locationEvents, key) => {
        if (locationEvents.length > 1) {
            // Multiple events at this location - create a group
            const [lng, lat] = key.split(',').map(Number);
            const sortedEvents = locationEvents.sort(
                (a, b) => b.volumeTotal - a.volumeTotal
            );

            groups.push({
                key,
                coordinates: [lng, lat],
                events: sortedEvents,
                totalVolume: locationEvents.reduce(
                    (sum, e) => sum + e.volumeTotal,
                    0
                ),
                maxHeat: Math.max(...locationEvents.map((e) => e.volumeHeat)),
                avgConfidence:
                    locationEvents.reduce(
                        (sum, e) => sum + e.geoLocation.confidence,
                        0
                    ) / locationEvents.length,
                countryName: locationEvents[0].geoLocation.countryName,
                cityName: locationEvents[0].geoLocation.cityName,
            });
        } else {
            // Single event at this location
            singleEvents.push(locationEvents[0]);
        }
    });

    return { groups, singleEvents };
}

// ============================================
// Expansion Position Calculator
// ============================================

/**
 * Calculates positions for expanded markers arranged in a circle.
 * Used when hovering over a cluster to fan out individual markers.
 *
 * @param events - Events to position in the expansion
 * @param radius - Distance from center in pixels
 * @param maxVisible - Maximum number of markers to show (default: 8)
 * @returns Array of events with their offset positions
 */
export function getExpandedPositions(
    events: GeoEnrichedEvent[],
    radius: number,
    maxVisible: number = 8
): ExpandedPosition[] {
    const visibleEvents = events.slice(0, maxVisible);
    const count = visibleEvents.length;

    return visibleEvents.map((event, i) => {
        // Distribute evenly in a circle, starting from top (-90 degrees)
        const angle = (2 * Math.PI * i) / count - Math.PI / 2;

        return {
            event,
            offset: {
                x: Math.cos(angle) * radius,
                y: Math.sin(angle) * radius,
            },
            angle,
        };
    });
}

/**
 * Checks if a coordinate key represents the same location as another.
 * Useful for matching hover/click events to clusters.
 */
export function isSameLocation(
    key1: string,
    key2: string,
    precision: number = 4
): boolean {
    const [lng1, lat1] = key1.split(',').map(Number);
    const [lng2, lat2] = key2.split(',').map(Number);

    return (
        lng1.toFixed(precision) === lng2.toFixed(precision) &&
        lat1.toFixed(precision) === lat2.toFixed(precision)
    );
}
