import useSWR from 'swr';
import { fetchMarkets } from '@/lib/api';
import { MarketNode } from '@/lib/types';

const REFRESH_INTERVAL = 15000; // 15 seconds

export function useMarketData() {
    const { data, error, isLoading } = useSWR<MarketNode[]>(
        'markets',
        fetchMarkets,
        {
            refreshInterval: REFRESH_INTERVAL,
            keepPreviousData: true, // Show old data while fetching new to avoid flickering
        }
    );

    return {
        markets: data || [],
        isLoading,
        isError: error,
    };
}
