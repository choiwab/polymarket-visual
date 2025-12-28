'use client';

import React from 'react';
import { Map, Grid3X3, Network } from 'lucide-react';
import { TabId } from '@/lib/types';

interface TabNavigationProps {
    activeTab: TabId;
    onTabChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string; icon: React.ElementType }> = [
    { id: 'heatmap', label: 'Heat Map', icon: Grid3X3 },
    { id: 'worldmap', label: 'World Map', icon: Map },
    { id: 'dependency', label: 'Dependencies', icon: Network },
];

export default function TabNavigation({
    activeTab,
    onTabChange,
}: TabNavigationProps) {
    return (
        <div className="flex items-center gap-1 bg-zinc-800/50 rounded-lg p-1">
            {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium
                            transition-all duration-200
                            ${
                                isActive
                                    ? 'bg-zinc-700 text-white shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
                            }
                        `}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
