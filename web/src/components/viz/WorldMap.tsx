'use client';

import {
    useRef,
    useEffect,
    useState,
    useMemo,
    useCallback,
} from 'react';
import * as d3 from 'd3';
import { GeoEnrichedEvent, ClusterMarker } from '@/lib/types';
import {
    groupEventsByLocation,
    getExpandedPositions,
} from '@/lib/markerClustering';

// ============================================
// Types
// ============================================

interface WorldMapProps {
    events: GeoEnrichedEvent[];
    onEventClick: (eventId: string) => void;
    onClusterClick: (events: GeoEnrichedEvent[]) => void;
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

interface TooltipData {
    type: 'event' | 'cluster';
    event?: GeoEnrichedEvent;
    cluster?: ClusterMarker;
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
const SIZE_RANGE = [8, 40]; // min/max radius in pixels
const EXPANSION_RADIUS = 20; // Distance for expanded markers
const MAX_EXPANDED_MARKERS = 6; // Max markers shown on hover

// Layer IDs
const SINGLE_MARKERS_SOURCE = 'single-markers-source';
const SINGLE_MARKERS_LAYER = 'single-markers-layer';
const CLUSTER_MARKERS_SOURCE = 'cluster-markers-source';
const CLUSTER_MARKERS_LAYER = 'cluster-markers-layer';
const CLUSTER_COUNT_LAYER = 'cluster-count-layer';

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
    data: TooltipData | null;
    position: { x: number; y: number } | null;
}

function Tooltip({ data, position }: TooltipProps) {
    if (!data || !position) return null;

    // Cluster tooltip
    if (data.type === 'cluster' && data.cluster) {
        const cluster = data.cluster;
        return (
            <div
                className="fixed z-[100] pointer-events-none bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl p-3 max-w-xs"
                style={{
                    left: position.x + 15,
                    top: position.y - 10,
                    transform: 'translateY(-50%)',
                }}
            >
                <h4 className="text-sm font-semibold text-white mb-2">
                    {cluster.count} Events in {cluster.countryName || 'this location'}
                </h4>
                <ul className="space-y-1 text-xs text-zinc-300 max-h-32 overflow-y-auto">
                    {cluster.events.slice(0, 5).map((e) => (
                        <li key={e.id} className="line-clamp-1 flex justify-between gap-2">
                            <span className="truncate">{e.title}</span>
                            <span className="text-zinc-500 flex-shrink-0">
                                ${d3.format('.2s')(e.volumeTotal)}
                            </span>
                        </li>
                    ))}
                    {cluster.count > 5 && (
                        <li className="text-zinc-500">+{cluster.count - 5} more...</li>
                    )}
                </ul>
                <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-zinc-500">
                    Hover to preview • Click to browse all
                </div>
            </div>
        );
    }

    // Single event tooltip
    if (data.type === 'event' && data.event) {
        const event = data.event;
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
                </div>
                <div className="mt-2 pt-2 border-t border-zinc-700 text-[10px] text-zinc-500">
                    Click for details
                </div>
            </div>
        );
    }

    return null;
}

// ============================================
// Component
// ============================================

export default function WorldMap({
    events,
    onEventClick,
    onClusterClick,
    onEventHover,
}: WorldMapProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapRef = useRef<mapboxgl.Map | null>(null);
    const expandedMarkersRef = useRef<HTMLDivElement[]>([]);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapboxgl, setMapboxgl] = useState<typeof import('mapbox-gl') | null>(
        null
    );
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const [tooltipPosition, setTooltipPosition] = useState<{
        x: number;
        y: number;
    } | null>(null);
    const [expandedClusterKey, setExpandedClusterKey] = useState<string | null>(
        null
    );

    // Store marker data for click/hover lookups
    const singleMarkersMapRef = useRef<Map<string, EventMarker>>(new Map());
    const clusterMarkersMapRef = useRef<Map<string, ClusterMarker>>(new Map());

    // Handle event hover
    const handleEventHover = useCallback(
        (event: GeoEnrichedEvent | null, position?: { x: number; y: number }) => {
            if (event) {
                setTooltipData({ type: 'event', event });
                setTooltipPosition(position || null);
            } else {
                setTooltipData(null);
                setTooltipPosition(null);
            }
            onEventHover?.(event);
        },
        [onEventHover]
    );

    // Handle cluster hover
    const handleClusterHover = useCallback(
        (cluster: ClusterMarker | null, position?: { x: number; y: number }) => {
            if (cluster) {
                setTooltipData({ type: 'cluster', cluster });
                setTooltipPosition(position || null);
            } else {
                setTooltipData(null);
                setTooltipPosition(null);
            }
        },
        []
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

        mapboxgl.default.accessToken = MAPBOX_TOKEN;

        const newMap = new mapboxgl.default.Map({
            container: mapContainer.current,
            style: MAP_STYLE,
            center: INITIAL_VIEW.center,
            zoom: INITIAL_VIEW.zoom,
            projection: 'globe',
        });

        mapRef.current = newMap;

        newMap.on('style.load', () => {
            // Add fog for atmosphere effect
            newMap.setFog({
                color: 'rgb(20, 20, 30)',
                'high-color': 'rgb(30, 30, 50)',
                'horizon-blend': 0.1,
                'space-color': 'rgb(10, 10, 15)',
                'star-intensity': 0.3,
            });

            setMapLoaded(true);
        });

        newMap.addControl(new mapboxgl.default.NavigationControl(), 'top-right');

        return () => {
            newMap.remove();
            mapRef.current = null;
        };
    }, [mapboxgl]);

    // Group events into clusters and singles
    const { clusterMarkers, singleMarkers } = useMemo(() => {
        if (!events.length) return { clusterMarkers: [], singleMarkers: [] };

        const { groups, singleEvents } = groupEventsByLocation(events);

        // Calculate size scale based on ALL volumes
        const allVolumes = [
            ...groups.map((g) => g.totalVolume),
            ...singleEvents.map((e) => e.volumeTotal),
        ];
        const volumeExtent = d3.extent(allVolumes) as [number, number];
        const sizeScale = d3.scaleSqrt().domain(volumeExtent).range(SIZE_RANGE);

        // Create cluster markers
        const clusterMarkers: ClusterMarker[] = groups.map((group) => ({
            id: `cluster-${group.key}`,
            key: group.key,
            coordinates: group.coordinates,
            events: group.events,
            size: sizeScale(group.totalVolume),
            color: heatColorScale(group.maxHeat),
            opacity: 0.4 + group.avgConfidence * 0.6,
            count: group.events.length,
            countryName: group.countryName,
        }));

        // Create single event markers
        const singleMarkers: EventMarker[] = singleEvents.map((event) => ({
            id: event.id,
            coordinates: [
                event.geoLocation.coordinates.lng,
                event.geoLocation.coordinates.lat,
            ],
            size: sizeScale(event.volumeTotal),
            color: heatColorScale(event.volumeHeat),
            opacity: 0.4 + event.geoLocation.confidence * 0.6,
            isPulsing: event.volumeHeat > 0.7,
            event,
        }));

        return { clusterMarkers, singleMarkers };
    }, [events]);

    // Clear expanded markers
    const clearExpandedMarkers = useCallback(() => {
        expandedMarkersRef.current.forEach((el) => {
            el.style.opacity = '0';
            el.style.transform = 'scale(0)';
            setTimeout(() => el.remove(), 200);
        });
        expandedMarkersRef.current = [];
        setExpandedClusterKey(null);
    }, []);

    // Create expanded markers for a cluster (using screen coordinates)
    const expandCluster = useCallback(
        (cluster: ClusterMarker, screenPoint: { x: number; y: number }) => {
            if (!mapRef.current || expandedClusterKey === cluster.key) return;

            clearExpandedMarkers();
            setExpandedClusterKey(cluster.key);

            // Calculate expansion radius based on cluster size to avoid overlap
            const effectiveRadius = Math.max(EXPANSION_RADIUS, cluster.size + 20);

            const positions = getExpandedPositions(
                cluster.events,
                effectiveRadius,
                MAX_EXPANDED_MARKERS
            );

            const MARKER_SIZE = 16;
            const HALF_MARKER = MARKER_SIZE / 2;

            positions.forEach((pos, index) => {
                const el = document.createElement('div');
                el.className = 'expanded-marker';
                el.style.cssText = `
                    position: fixed;
                    width: ${MARKER_SIZE}px;
                    height: ${MARKER_SIZE}px;
                    background-color: ${heatColorScale(pos.event.volumeHeat)};
                    border: 2px solid white;
                    border-radius: 50%;
                    cursor: pointer;
                    z-index: 200;
                    opacity: 0;
                    transform: scale(0);
                    transition: all 0.2s ease-out;
                    transition-delay: ${index * 30}ms;
                    pointer-events: auto;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                `;

                // Position relative to screen point (center of cluster)
                // Subtract half marker size to center the marker on its calculated position
                el.style.left = `${screenPoint.x + pos.offset.x - HALF_MARKER}px`;
                el.style.top = `${screenPoint.y + pos.offset.y - HALF_MARKER}px`;

                // Hover effects
                el.addEventListener('mouseenter', (e) => {
                    el.style.transform = 'scale(1.3)';
                    el.style.zIndex = '250';
                    handleEventHover(pos.event, {
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
                    el.style.zIndex = '200';
                    handleEventHover(null);
                });

                // Click handler
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    setTooltipData(null);
                    setTooltipPosition(null);
                    onEventClick(pos.event.id);
                });

                document.body.appendChild(el);
                expandedMarkersRef.current.push(el);

                // Trigger animation
                requestAnimationFrame(() => {
                    el.style.opacity = '1';
                    el.style.transform = 'scale(1)';
                });
            });

            // Add "+N more" indicator if needed
            if (cluster.events.length > MAX_EXPANDED_MARKERS) {
                const moreEl = document.createElement('div');
                moreEl.className = 'more-indicator';
                moreEl.style.cssText = `
                    position: fixed;
                    background: rgba(0,0,0,0.8);
                    color: white;
                    font-size: 10px;
                    padding: 2px 6px;
                    border-radius: 10px;
                    z-index: 200;
                    opacity: 0;
                    transition: opacity 0.2s;
                    pointer-events: none;
                `;
                moreEl.textContent = `+${cluster.events.length - MAX_EXPANDED_MARKERS}`;

                // Position below the cluster, accounting for effective radius
                moreEl.style.left = `${screenPoint.x}px`;
                moreEl.style.top = `${screenPoint.y + effectiveRadius + 20}px`;
                moreEl.style.transform = 'translateX(-50%)';

                document.body.appendChild(moreEl);
                expandedMarkersRef.current.push(moreEl);

                requestAnimationFrame(() => {
                    moreEl.style.opacity = '1';
                });
            }
        },
        [
            expandedClusterKey,
            clearExpandedMarkers,
            handleEventHover,
            onEventClick,
        ]
    );

    // Update map layers with marker data
    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;

        const map = mapRef.current;

        // Update lookup maps
        singleMarkersMapRef.current.clear();
        singleMarkers.forEach((m) => singleMarkersMapRef.current.set(m.id, m));

        clusterMarkersMapRef.current.clear();
        clusterMarkers.forEach((c) => clusterMarkersMapRef.current.set(c.id, c));

        // Create GeoJSON for single markers
        const singleMarkersGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: singleMarkers.map((marker) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: marker.coordinates,
                },
                properties: {
                    id: marker.id,
                    size: marker.size,
                    color: marker.color,
                    opacity: marker.opacity,
                    isPulsing: marker.isPulsing,
                },
            })),
        };

        // Create GeoJSON for cluster markers
        const clusterMarkersGeoJSON: GeoJSON.FeatureCollection = {
            type: 'FeatureCollection',
            features: clusterMarkers.map((cluster) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: cluster.coordinates,
                },
                properties: {
                    id: cluster.id,
                    size: cluster.size,
                    color: cluster.color,
                    opacity: cluster.opacity,
                    count: cluster.count,
                },
            })),
        };

        // Add or update single markers source and layer
        if (map.getSource(SINGLE_MARKERS_SOURCE)) {
            (map.getSource(SINGLE_MARKERS_SOURCE) as mapboxgl.GeoJSONSource).setData(
                singleMarkersGeoJSON
            );
        } else {
            map.addSource(SINGLE_MARKERS_SOURCE, {
                type: 'geojson',
                data: singleMarkersGeoJSON,
            });

            map.addLayer({
                id: SINGLE_MARKERS_LAYER,
                type: 'circle',
                source: SINGLE_MARKERS_SOURCE,
                paint: {
                    'circle-radius': ['get', 'size'],
                    'circle-color': ['get', 'color'],
                    'circle-opacity': ['get', 'opacity'],
                    'circle-stroke-width': 2,
                    'circle-stroke-color': 'rgba(255, 255, 255, 0.3)',
                },
            });
        }

        // Add or update cluster markers source and layer
        if (map.getSource(CLUSTER_MARKERS_SOURCE)) {
            (map.getSource(CLUSTER_MARKERS_SOURCE) as mapboxgl.GeoJSONSource).setData(
                clusterMarkersGeoJSON
            );
        } else {
            map.addSource(CLUSTER_MARKERS_SOURCE, {
                type: 'geojson',
                data: clusterMarkersGeoJSON,
            });

            map.addLayer({
                id: CLUSTER_MARKERS_LAYER,
                type: 'circle',
                source: CLUSTER_MARKERS_SOURCE,
                paint: {
                    'circle-radius': ['get', 'size'],
                    'circle-color': ['get', 'color'],
                    'circle-opacity': ['get', 'opacity'],
                    'circle-stroke-width': 3,
                    'circle-stroke-color': 'rgba(255, 255, 255, 0.5)',
                },
            });

            // Add count labels for clusters
            map.addLayer({
                id: CLUSTER_COUNT_LAYER,
                type: 'symbol',
                source: CLUSTER_MARKERS_SOURCE,
                layout: {
                    'text-field': ['get', 'count'],
                    'text-size': 12,
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-offset': [0.6, -0.6],
                    'text-anchor': 'bottom-left',
                },
                paint: {
                    'text-color': '#ffffff',
                    'text-halo-color': '#3b82f6',
                    'text-halo-width': 6,
                },
            });
        }
    }, [mapLoaded, singleMarkers, clusterMarkers]);

    // Set up event handlers for layers
    useEffect(() => {
        if (!mapRef.current || !mapLoaded) return;

        const map = mapRef.current;
        let hoverTimeout: NodeJS.Timeout | null = null;

        // Single marker click
        const handleSingleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            if (e.features && e.features.length > 0) {
                const id = e.features[0].properties?.id;
                if (id) {
                    setTooltipData(null);
                    setTooltipPosition(null);
                    onEventClick(id);
                }
            }
        };

        // Single marker hover
        const handleSingleMouseEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                const id = e.features[0].properties?.id;
                const marker = singleMarkersMapRef.current.get(id);
                if (marker) {
                    handleEventHover(marker.event, { x: e.point.x, y: e.point.y });
                }
            }
        };

        const handleSingleMouseLeave = () => {
            map.getCanvas().style.cursor = '';
            handleEventHover(null);
        };

        const handleSingleMouseMove = (e: mapboxgl.MapMouseEvent) => {
            setTooltipPosition({ x: e.point.x, y: e.point.y });
        };

        // Cluster marker click
        const handleClusterClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            if (e.features && e.features.length > 0) {
                const id = e.features[0].properties?.id;
                const cluster = clusterMarkersMapRef.current.get(id);
                if (cluster) {
                    setTooltipData(null);
                    setTooltipPosition(null);
                    clearExpandedMarkers();
                    onClusterClick(cluster.events);
                }
            }
        };

        // Cluster marker hover
        const handleClusterMouseEnter = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
            map.getCanvas().style.cursor = 'pointer';
            if (e.features && e.features.length > 0) {
                const id = e.features[0].properties?.id;
                const cluster = clusterMarkersMapRef.current.get(id);
                if (cluster) {
                    handleClusterHover(cluster, { x: e.point.x, y: e.point.y });

                    // Delay expansion
                    hoverTimeout = setTimeout(() => {
                        const rect = mapContainer.current?.getBoundingClientRect();
                        if (rect) {
                            // Project the cluster's actual coordinates to screen space
                            // This ensures the expanded markers are centered on the cluster, not the mouse
                            const projected = map.project(cluster.coordinates as [number, number]);
                            expandCluster(cluster, {
                                x: projected.x + rect.left,
                                y: projected.y + rect.top,
                            });
                        }
                    }, 300);
                }
            }
        };

        const handleClusterMouseLeave = () => {
            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
                hoverTimeout = null;
            }
            map.getCanvas().style.cursor = '';
            handleClusterHover(null);
            // Don't immediately clear expanded markers - let the mousemove handler decide
        };

        const handleClusterMouseMove = (e: mapboxgl.MapMouseEvent) => {
            setTooltipPosition({ x: e.point.x, y: e.point.y });
        };

        // Clear expanded markers on map interaction
        const handleInteractionStart = () => {
            if (expandedMarkersRef.current.length > 0) {
                expandedMarkersRef.current.forEach((el) => el.remove());
                expandedMarkersRef.current = [];
                setExpandedClusterKey(null);
                setTooltipData(null);
                setTooltipPosition(null);
            }
        };

        // Global mouse move to clean up expanded markers
        const handleDocumentMouseMove = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (
                expandedClusterKey &&
                !target.classList.contains('expanded-marker') &&
                !target.classList.contains('more-indicator') &&
                !mapContainer.current?.contains(target)
            ) {
                clearExpandedMarkers();
            }
        };

        // Register event handlers
        map.on('click', SINGLE_MARKERS_LAYER, handleSingleClick);
        map.on('mouseenter', SINGLE_MARKERS_LAYER, handleSingleMouseEnter);
        map.on('mouseleave', SINGLE_MARKERS_LAYER, handleSingleMouseLeave);
        map.on('mousemove', SINGLE_MARKERS_LAYER, handleSingleMouseMove);

        map.on('click', CLUSTER_MARKERS_LAYER, handleClusterClick);
        map.on('mouseenter', CLUSTER_MARKERS_LAYER, handleClusterMouseEnter);
        map.on('mouseleave', CLUSTER_MARKERS_LAYER, handleClusterMouseLeave);
        map.on('mousemove', CLUSTER_MARKERS_LAYER, handleClusterMouseMove);

        map.on('movestart', handleInteractionStart);
        map.on('zoomstart', handleInteractionStart);
        map.on('rotatestart', handleInteractionStart);
        map.on('pitchstart', handleInteractionStart);
        map.on('dragstart', handleInteractionStart);
        map.on('wheel', handleInteractionStart);

        document.addEventListener('mousemove', handleDocumentMouseMove);

        return () => {
            map.off('click', SINGLE_MARKERS_LAYER, handleSingleClick);
            map.off('mouseenter', SINGLE_MARKERS_LAYER, handleSingleMouseEnter);
            map.off('mouseleave', SINGLE_MARKERS_LAYER, handleSingleMouseLeave);
            map.off('mousemove', SINGLE_MARKERS_LAYER, handleSingleMouseMove);

            map.off('click', CLUSTER_MARKERS_LAYER, handleClusterClick);
            map.off('mouseenter', CLUSTER_MARKERS_LAYER, handleClusterMouseEnter);
            map.off('mouseleave', CLUSTER_MARKERS_LAYER, handleClusterMouseLeave);
            map.off('mousemove', CLUSTER_MARKERS_LAYER, handleClusterMouseMove);

            map.off('movestart', handleInteractionStart);
            map.off('zoomstart', handleInteractionStart);
            map.off('rotatestart', handleInteractionStart);
            map.off('pitchstart', handleInteractionStart);
            map.off('dragstart', handleInteractionStart);
            map.off('wheel', handleInteractionStart);

            document.removeEventListener('mousemove', handleDocumentMouseMove);

            if (hoverTimeout) {
                clearTimeout(hoverTimeout);
            }
        };
    }, [
        mapLoaded,
        onEventClick,
        onClusterClick,
        handleEventHover,
        handleClusterHover,
        expandCluster,
        clearExpandedMarkers,
        expandedClusterKey,
    ]);

    // Show placeholder if no token
    if (!MAPBOX_TOKEN) {
        return (
            <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                <div className="text-center text-zinc-400 p-8">
                    <p className="text-lg font-medium mb-2">Mapbox Token Required</p>
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

    const totalEvents = singleMarkers.length + clusterMarkers.reduce((sum, c) => sum + c.count, 0);
    const clusterCount = clusterMarkers.length;

    return (
        <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
            <div
                ref={mapContainer}
                className="absolute inset-0"
                style={{ width: '100%', height: '100%' }}
            />

            {/* Tooltip */}
            <Tooltip data={tooltipData} position={tooltipPosition} />

            {/* Stats badge */}
            <div className="absolute bottom-4 left-4 bg-zinc-900/90 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-400 z-10">
                <span className="text-white font-medium">{totalEvents}</span> events
                {clusterCount > 0 && (
                    <span className="ml-2">
                        (<span className="text-blue-400">{clusterCount}</span> clusters)
                    </span>
                )}
            </div>

            {/* Styles */}
            <style jsx global>{`
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
