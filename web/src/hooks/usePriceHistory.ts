import useSWR from 'swr';
import { useMemo } from 'react';
import { fetchMultiplePriceHistories } from '@/lib/api';
import { PriceHistoryPoint, TimeWindow } from '@/lib/types';

const REFRESH_INTERVAL = 60000; // 60 seconds - price history changes slowly

/**
 * Hook to fetch price history for multiple markets.
 * Uses SWR for caching and automatic refresh.
 */
export function usePriceHistory(
    marketIds: string[],
    interval: TimeWindow = '24h'
) {
    // Create a stable cache key from sorted market IDs
    const cacheKey = useMemo(() => {
        if (marketIds.length === 0) return null;
        const sortedIds = [...marketIds].sort().join(',');
        return `price-history-${interval}-${sortedIds}`;
    }, [marketIds, interval]);

    const fetcher = async () => {
        if (marketIds.length === 0) {
            return new Map<string, PriceHistoryPoint[]>();
        }
        return fetchMultiplePriceHistories(marketIds, interval);
    };

    const { data, error, isLoading } = useSWR<Map<string, PriceHistoryPoint[]>>(
        cacheKey,
        fetcher,
        {
            refreshInterval: REFRESH_INTERVAL,
            keepPreviousData: true,
            dedupingInterval: 5000, // Prevent duplicate requests within 5s
            revalidateOnFocus: false, // Don't refetch on window focus
        }
    );

    return {
        histories: data || new Map<string, PriceHistoryPoint[]>(),
        isLoading,
        isError: error,
    };
}

/**
 * Hook to fetch price history for a single market.
 */
export function useSinglePriceHistory(
    marketId: string | null,
    interval: TimeWindow = '24h'
) {
    const marketIds = useMemo(
        () => (marketId ? [marketId] : []),
        [marketId]
    );

    const { histories, isLoading, isError } = usePriceHistory(marketIds, interval);

    return {
        history: marketId ? histories.get(marketId) || [] : [],
        isLoading,
        isError,
    };
}
