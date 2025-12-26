'use client';

import React, {
    useRef,
    useEffect,
    useState,
    useMemo,
    useCallback,
} from 'react';
import * as d3 from 'd3';
import { GeoEnrichedEvent } from '@/lib/types';

// ============================================
// Types
// ============================================

interface WorldMapProps {
    events: GeoEnrichedEvent[];
    onEventClick: (eventId: string) => void;
    onEventHover?: (event: GeoEnrichedEvent | null) => void;
}

interface EventMarker {
    id: string;
    coordinates: [number, number]; // [lng, lat]
    size: number; // Pixel radius
    color: string; // Heat color
    opacity: number; // Based on confidence
    isPulsing: boolean; // High velocity events
    event: GeoEnrichedEvent;
}

// ============================================
// Constants
// ============================================

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

const MAP_STYLE = 'mapbox://styles/mapbox/dark-v11';

const INITIAL_VIEW = {
    center: [0, 20] as [number, number],
    zoom: 1.5,
};

// Size scale: volume -> pixel radius
const SIZE_RANGE = [10, 50]; // min/max radius in pixels

// ============================================
// Color Scale (matches HeatMap)
// ============================================

const heatColorScale = (heat: number): string => {
    const h = Math.min(Math.max(heat, 0), 1);
    if (h < 0.5) {
        return d3.interpolateRgb('#22c55e', '#eab308')(h * 2);
    }
    return d3.interpolateRgb('#eab308', '#ef4444')((h - 0.5) * 2);
};

// ============================================
// Hover Tooltip Component
// ============================================

interface TooltipProps {
    event: GeoEnrichedEvent | null;
    position: { x: number; y: number } | null;
}

function Tooltip({ event, position }: TooltipProps) {
    if (!event || !position) return null;

    return (
        <div
            className="fixed z-[100] pointer-events-none bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs"
            style={{
                left: position.x + 15,
                top: position.y - 10,
                transform: 'translateY(-50%)',
            }}
        >
            <h4 className="text-sm font-semibold text-white line-clamp-2 mb-2">
                {event.title}
            </h4>
            <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between gap-4">
                    <span>Volume:</span>
                    <span className="font-mono text-zinc-200">
                        ${d3.format('.2s')(event.volumeTotal)}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>24h:</span>
                    <span className="font-mono text-zinc-200">
                        ${d3.format('.2s')(event.volume24h)}
                    </span>
                </div>
                <div className="flex justify-between gap-4">
                    <span>Markets:</span>
                    <span className="text-zinc-200">{event.marketCount}</span>
                </div>
                {event.geoLocation.countryName && (
                    <div className="flex justify-between gap-4">
                        <span>Location:</span>
                        <span className="text-zinc-200">
                            {event.geoLocation.countryName}
                        </span>
                    </div>
                )}
            </div>
            <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-zinc-500">
                Click for details
            </div>
        </div>
    );
}

// ============================================
// Component
// ============================================

export default function WorldMap({
    events,
    onEventClick,
    onEventHover,
}: WorldMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const markersRef = useRef<mapboxgl.Marker[]>([]);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapboxgl, setMapboxgl] = useState<typeof import('mapbox-gl') | null>(
        null
    );
    const [hoveredEvent, setHoveredEvent] = useState<GeoEnrichedEvent | null>(
        null
    );
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);

    // Handle hover
    const handleHover = useCallback(
        (
            event: GeoEnrichedEvent | null,
            position?: { x: number; y: number }
        ) => {
            setHoveredEvent(event);
            setTooltipPosition(position || null);
            onEventHover?.(event);
        },
        [onEventHover]
    );

    // Dynamically import mapbox-gl (avoids SSR issues)
    useEffect(() => {
        import('mapbox-gl').then((mb) => {
            setMapboxgl(mb);
        });
    }, []);

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || !mapboxgl || mapRef.current) return;

        if (!MAPBOX_TOKEN) {
            console.warn(
                'Mapbox token not found. Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local'
            );
            return;
        }

        // Debug: Check container dimensions
        const rect = mapContainer.current.getBoundingClientRect();
        console.log('Map container dimensions:', rect.width, 'x', rect.height);

        if (rect.width === 0 || rect.height === 0) {
            console.warn('Map container has zero dimensions');
        }

        mapboxgl.default.accessToken = MAPBOX_TOKEN;

        const newMap = new mapboxgl.default.Map({
            container: mapContainer.current,
            style: MAP_STYLE,
            center: INITIAL_VIEW.center,
            zoom: INITIAL_VIEW.zoom,
            projection: 'mercator',
        });

        mapRef.current = newMap;

        newMap.on('load', () => {
            console.log('Mapbox map loaded successfully');
            // Trigger resize to ensure proper rendering
            setTimeout(() => {
                newMap.resize();
            }, 100);
            setMapLoaded(true);
        });

        newMap.on('error', (e) => {
            console.error('Mapbox error:', e);
        });

        // Add navigation controls
        newMap.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

        // Cleanup
        return () => {
            newMap.remove();
            mapRef.current = null;
        };
    }, [mapboxgl]);

    // Transform events to markers
    const markers = useMemo((): EventMarker[] => {
        console.log('WorldMap received events:', events.length);
        if (!events.length) return [];

        // Calculate size scale based on volume range
        const volumes = events.map((e) => e.volumeTotal);
        const volumeExtent = d3.extent(volumes) as [number, number];
        const sizeScale = d3
            .scaleSqrt()
            .domain(volumeExtent)
            .range(SIZE_RANGE);

        const result = events.map(
            (event): EventMarker => ({
                id: event.id,
                coordinates: [
                    event.geoLocation.coordinates.lng,
                    event.geoLocation.coordinates.lat,
                ],
                size: sizeScale(event.volumeTotal),
                color: heatColorScale(event.volumeHeat),
                opacity: 0.4 + event.geoLocation.confidence * 0.6, // 0.4 to 1.0
                isPulsing: event.volumeHeat > 0.7,
                event,
            })
        );
        console.log('WorldMap created markers:', result.length);
        return result;
    }, [events]);

    // Render markers when map is loaded or markers change
    useEffect(() => {
        if (!mapRef.current || !mapLoaded || !mapboxgl) return;

        // Clear existing markers
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];

        // Add new markers
        markers.forEach((marker) => {
            const el = document.createElement('div');
            el.className = 'world-map-marker';
            el.style.cssText = `
                width: ${marker.size * 2}px;
                height: ${marker.size * 2}px;
                background-color: ${marker.color};
                opacity: ${marker.opacity};
                border-radius: 50%;
                cursor: pointer;
                border: 2px solid rgba(255, 255, 255, 0.3);
                transition: transform 0.2s, box-shadow 0.2s;
                ${marker.isPulsing ? 'animation: worldMapPulse 2s infinite;' : ''}
            `;

            // Hover effects
            el.addEventListener('mouseenter', (e) => {
                el.style.transform = 'scale(1.2)';
                el.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.5)';
                el.style.zIndex = '100';
                handleHover(marker.event, {
                    x: (e as MouseEvent).clientX,
                    y: (e as MouseEvent).clientY,
                });
            });

            el.addEventListener('mousemove', (e) => {
                setTooltipPosition({
                    x: (e as MouseEvent).clientX,
                    y: (e as MouseEvent).clientY,
                });
            });

            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)';
                el.style.boxShadow = 'none';
                el.style.zIndex = '1';
                handleHover(null);
            });

            // Click handler
            el.addEventListener('click', () => {
                onEventClick(marker.id);
            });

            const mapboxMarker = new mapboxgl.default.Marker({ element: el })
                .setLngLat(marker.coordinates)
                .addTo(mapRef.current!);

            markersRef.current.push(mapboxMarker);
        });
    }, [markers, mapLoaded, mapboxgl, onEventClick, handleHover]);

    // Show placeholder if no token
    if (!MAPBOX_TOKEN) {
        return (
            <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                <div className="text-center text-zinc-400 p-8">
                    <p className="text-lg font-medium mb-2">
                        Mapbox Token Required
                    </p>
                    <p className="text-sm">
                        Add NEXT_PUBLIC_MAPBOX_TOKEN to your .env.local file
                    </p>
                    <p className="text-xs mt-4 text-zinc-500">
                        Get a free token at{' '}
                        <a
                            href="https://mapbox.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:underline"
                        >
                            mapbox.com
                        </a>
                    </p>
                </div>
            </div>
        );
    }

    // Show loading while mapbox loads
    if (!mapboxgl) {
        return (
            <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                <div className="text-center text-zinc-400">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm">Loading map...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
            <div
                ref={mapContainer}
                className="absolute inset-0"
                style={{ width: '100%', height: '100%' }}
            />

            {/* Tooltip */}
            <Tooltip event={hoveredEvent} position={tooltipPosition} />

            {/* Event count badge */}
            <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 z-10">
                <span className="text-white font-medium">{events.length}</span>{' '}
                events on map
            </div>

            {/* Pulse animation styles */}
            <style jsx global>{`
                @keyframes worldMapPulse {
                    0% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
                    }
                    70% {
                        box-shadow: 0 0 0 15px rgba(239, 68, 68, 0);
                    }
                    100% {
                        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
                    }
                }

                .mapboxgl-map {
                    width: 100% !important;
                    height: 100% !important;
                }

                .mapboxgl-canvas {
                    outline: none;
                    width: 100% !important;
                    height: 100% !important;
                }

                .mapboxgl-canvas-container {
                    width: 100% !important;
                    height: 100% !important;
                }
            `}</style>
        </div>
    );
}
