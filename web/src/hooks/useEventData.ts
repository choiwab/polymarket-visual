import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchEvents } from '@/lib/api';
import { ProcessedEvent, Category } from '@/lib/types';
import { CATEGORIES } from '@/lib/categories';

const REFRESH_INTERVAL = 15000; // 15 seconds

/**
 * Hook to fetch and process events from the Polymarket API
 */
export function useEventData() {
    const { data, error, isLoading } = useSWR<ProcessedEvent[]>(
        'events',
        fetchEvents,
        {
            refreshInterval: REFRESH_INTERVAL,
            keepPreviousData: true,
        }
    );

    // Aggregate events into categories
    const categories = useMemo(() => {
        if (!data || data.length === 0) return [];

        const categoryMap = new Map<string, Category>();

        // Initialize all categories
        for (const categoryName of CATEGORIES) {
            const id = categoryName.toLowerCase().replace(/\s+/g, '-');
            categoryMap.set(id, {
                id,
                name: categoryName,
                volumeTotal: 0,
                volume24h: 0,
                volumeHeat: 0,
                confidence: 1,
                eventCount: 0,
                events: [],
            });
        }

        // Aggregate events into categories
        for (const event of data) {
            const category = categoryMap.get(event.categoryId);
            if (category) {
                category.volumeTotal += event.volumeTotal;
                category.volume24h += event.volume24h;
                category.eventCount++;
                category.events.push(event);
            } else {
                // If category doesn't exist, add to "Other"
                const other = categoryMap.get('other')!;
                other.volumeTotal += event.volumeTotal;
                other.volume24h += event.volume24h;
                other.eventCount++;
                other.events.push({
                    ...event,
                    categoryId: 'other',
                });
            }
        }

        // Compute heat for each category
        for (const category of categoryMap.values()) {
            if (category.volumeTotal > 0) {
                const ratio = category.volume24h / (category.volumeTotal + 0.0001);
                category.volumeHeat = Math.min(Math.max(ratio * 10, 0), 1);
            }
        }

        // Filter out empty categories and sort by volume
        return Array.from(categoryMap.values())
            .filter((c) => c.eventCount > 0)
            .sort((a, b) => b.volumeTotal - a.volumeTotal);
    }, [data]);

    // Get events for a specific category
    const getEventsForCategory = (categoryId: string): ProcessedEvent[] => {
        const category = categories.find((c) => c.id === categoryId);
        return category?.events || [];
    };

    // Get a specific event by ID
    const getEventById = (eventId: string): ProcessedEvent | undefined => {
        return data?.find((e) => e.id === eventId);
    };

    return {
        events: data || [],
        categories,
        isLoading,
        isError: error,
        getEventsForCategory,
        getEventById,
    };
}
