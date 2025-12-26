'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { ViewState } from '@/lib/types';

interface BreadcrumbProps {
    viewState: ViewState;
    onNavigate: (level: 'category' | 'event' | 'market', id?: string) => void;
}

export default function Breadcrumb({ viewState, onNavigate }: BreadcrumbProps) {
    const items: Array<{
        label: string;
        level: 'category' | 'event' | 'market';
        isActive: boolean;
    }> = [];

    // Always show "Categories" as first item
    items.push({
        label: 'Categories',
        level: 'category',
        isActive: viewState.level === 'category',
    });

    // Show selected category if we're at event or market level
    if (
        viewState.level === 'event' ||
        viewState.level === 'market'
    ) {
        items.push({
            label: viewState.selectedCategoryName || 'Category',
            level: 'event',
            isActive: viewState.level === 'event',
        });
    }

    // Show selected event if we're at market level
    if (viewState.level === 'market') {
        items.push({
            label: viewState.selectedEventTitle || 'Event',
            level: 'market',
            isActive: true,
        });
    }

    return (
        <nav className="flex items-center gap-1 text-sm">
            {items.map((item, index) => (
                <React.Fragment key={item.level + index}>
                    {index > 0 && (
                        <ChevronRight className="w-4 h-4 text-zinc-500" />
                    )}
                    {item.isActive ? (
                        <span className="text-white font-medium truncate max-w-[200px]">
                            {item.label}
                        </span>
                    ) : (
                        <button
                            onClick={() => onNavigate(item.level)}
                            className="text-zinc-400 hover:text-white transition-colors truncate max-w-[200px]"
                        >
                            {item.label}
                        </button>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}
