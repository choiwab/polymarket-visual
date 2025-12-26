import { useMemo } from 'react';
import { useEventData } from './useEventData';
import { inferEventLocation } from '@/lib/geo';
import { GeoEnrichedEvent } from '@/lib/types';

/**
 * Hook that enriches events with geographic location data
 * Wraps useEventData and adds geo-inference to each event
 */
export function useGeoEnrichedEvents() {
    const {
        events,
        categories,
        isLoading,
        isError,
        getEventsForCategory,
        getEventById,
    } = useEventData();

    // Enrich all events with geo data
    const geoEvents = useMemo((): GeoEnrichedEvent[] => {
        return events.map((event) => {
            const { geoLocation } = inferEventLocation(event);
            return {
                ...event,
                geoLocation,
            };
        });
    }, [events]);

    // Filter to only events with sufficient geo confidence for mapping
    // Excludes global events and low-confidence matches
    const mappableEvents = useMemo(() => {
        return geoEvents.filter(
            (e) =>
                e.geoLocation.type === 'point' &&
                e.geoLocation.confidence >= 0.3
        );
    }, [geoEvents]);

    // Get geo-enriched event by ID
    const getGeoEventById = (eventId: string): GeoEnrichedEvent | undefined => {
        return geoEvents.find((e) => e.id === eventId);
    };

    // Get mappable events for a specific category
    const getMappableEventsForCategory = (
        categoryId: string
    ): GeoEnrichedEvent[] => {
        return mappableEvents.filter((e) => e.categoryId === categoryId);
    };

    // Stats for debugging/display
    const geoStats = useMemo(() => {
        const total = geoEvents.length;
        const mappable = mappableEvents.length;
        const byType = {
            point: geoEvents.filter((e) => e.geoLocation.type === 'point')
                .length,
            regional: geoEvents.filter((e) => e.geoLocation.type === 'regional')
                .length,
            global: geoEvents.filter((e) => e.geoLocation.type === 'global')
                .length,
        };
        const avgConfidence =
            geoEvents.length > 0
                ? geoEvents.reduce(
                      (sum, e) => sum + e.geoLocation.confidence,
                      0
                  ) / geoEvents.length
                : 0;

        return {
            total,
            mappable,
            byType,
            avgConfidence,
        };
    }, [geoEvents, mappableEvents]);

    return {
        // All events with geo data
        events: geoEvents,
        // Only events that can be placed on a map
        mappableEvents,
        // Original category data
        categories,
        // Loading states
        isLoading,
        isError,
        // Getter functions
        getEventsForCategory,
        getEventById,
        getGeoEventById,
        getMappableEventsForCategory,
        // Stats
        geoStats,
    };
}
