import React, { useEffect, useRef, useState, useMemo } from 'react';
import type {
  NetworkNode,
  NetworkLink,
  LinkPerformanceResult,
  AuthorType,
  NetworkRoute,
} from '../types/traffic';
import {
  Layers,
  AlertTriangle,
  CheckCircle,
  PlusCircle,
  Activity,
  X,
  Maximize2,
  ShieldAlert,
  Info,
  Navigation,
  Compass,
  CornerDownRight,
  CornerUpRight,
  CornerUpLeft,
  ArrowRight,
  MapPin,
  Flag,
  Share2,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapWorkspaceProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  linkResults: Record<string, LinkPerformanceResult>;
  activeAlternative: AuthorType;
  selectedLinkId: string | null;
  onSelectLink: (linkId: string) => void;
  center: [number, number];
  zoom: number;
  onAddInterventionForLink?: (linkId: string) => void;
  routes: NetworkRoute[];
  selectedRoute: NetworkRoute | null;
  onSelectRoute: (route: NetworkRoute | null) => void;
  onAnalyseRouteThroughLink?: (linkId: string) => void;
}

function calcBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const MapWorkspace: React.FC<MapWorkspaceProps> = ({
  nodes,
  links,
  linkResults,
  activeAlternative,
  selectedLinkId,
  onSelectLink,
  center,
  zoom,
  onAddInterventionForLink,
  routes,
  selectedRoute,
  onSelectRoute,
  onAnalyseRouteThroughLink,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState<boolean>(false);
  const [isInspectorMinimized, setIsInspectorMinimized] = useState<boolean>(false);
  const [isTurnDetailsOpen, setIsTurnDetailsOpen] = useState<boolean>(true);

  // 1. Initialize Map with CartoDB Dark Matter basemap (free, fast, dark GIS aesthetic)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false,
      attributionControl: true,
    });

    L.control.zoom({ position: 'topleft' }).addTo(map);

    // CartoDB Dark Matter tiles (subdued dark GIS aesthetic, ideal for high-contrast traffic flow)
    const darkLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        subdomains: 'abcd',
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      }
    );

    darkLayer.on('tileerror', () => {
      setTileError(true);
      // Fallback to standard OSM if Carto is unavailable
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    });

    darkLayer.addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Automatically fit bounds to selected route or corridor
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    map.invalidateSize();

    if (selectedRoute && selectedRoute.geometry.length > 0) {
      // Fit to selected route
      const routeBounds = L.latLngBounds(selectedRoute.geometry);
      map.fitBounds(routeBounds, {
        padding: [60, 60],
        maxZoom: 17,
        animate: true,
      });
    } else if (links.length > 0) {
      // Fit to full corridor
      const allLatLngs: [number, number][] = [];
      links.forEach((l) => {
        l.coordinates.forEach((c) => {
          allLatLngs.push([c[1], c[0]]);
        });
      });
      if (allLatLngs.length > 0) {
        const bounds = L.latLngBounds(allLatLngs);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 17,
          animate: true,
        });
      }
    }
  }, [selectedRoute, links, center, zoom]);

  // 3. Render Road Network, Selected Route, Directional Chevrons, & Junctions
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    const isRouteActive = Boolean(selectedRoute);
    const routeLinkIds = new Set(selectedRoute?.link_ids || []);

    const getLinkColor = (vc: number, isClosed: boolean) => {
      if (isClosed) return '#EF4444'; // Red-orange for Closed Roads
      if (vc >= 1.0) return '#EF4444'; // Red: Oversaturated
      if (vc >= 0.85) return '#F59E0B'; // Amber: Heavy
      if (vc >= 0.65) return '#EAB308'; // Yellow-Amber: Moderate
      return '#10B981'; // Emerald: Free flow
    };

    // Draw all road links
    links.forEach((l) => {
      const res = linkResults[l.id];
      const vc = res ? res.vc_ratio : (l.base_capacity_vph ? 0.5 : 0.0);
      const isSelectedLink = selectedLinkId === l.id;
      const isDirect = res ? res.is_directly_modified : false;
      const isClosed = res ? res.capacity_vph <= 0 : false;
      const isPartOfRoute = routeLinkIds.has(l.id);

      // GeoJSON [[lon, lat], ...] to Leaflet [[lat, lon], ...]
      const latLngs: [number, number][] = l.coordinates.map((c) => [c[1], c[0]]);
      if (latLngs.length < 2) return;

      if (isRouteActive && !isPartOfRoute) {
        // Dim unselected roads in route mode
        L.polyline(latLngs, {
          color: '#334155',
          weight: 3,
          opacity: 0.35,
          lineCap: 'round',
        }).addTo(group);
        return;
      }

      // Layer 1: Selection / Intervention Glow Halo
      if (isSelectedLink || isDirect || isPartOfRoute) {
        L.polyline(latLngs, {
          color: isDirect ? '#10B981' : isPartOfRoute ? '#3B82F6' : '#60A5FA',
          weight: isPartOfRoute ? 14 : 12,
          opacity: isPartOfRoute ? 0.45 : 0.4,
          lineCap: 'round',
        }).addTo(group);
      }

      // Layer 2: Deep Slate Casing
      L.polyline(latLngs, {
        color: '#0B0F14',
        weight: isSelectedLink || isPartOfRoute ? 8 : 6,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // Layer 3: Inner Congestion / Route Stroke
      const strokeColor = isPartOfRoute ? '#3B82F6' : getLinkColor(vc, isClosed);
      const poly = L.polyline(latLngs, {
        color: strokeColor,
        weight: isSelectedLink || isPartOfRoute ? 5 : 4,
        opacity: 1.0,
        dashArray: isClosed ? '6, 6' : vc >= 1.0 && !isPartOfRoute ? '8, 5' : undefined,
        lineCap: 'round',
      }).addTo(group);

      // Interaction
      poly.on('click', () => {
        onSelectLink(l.id);
        setIsInspectorMinimized(false);
      });

      // Tooltip
      const delayInfo = res ? `${res.delay_sec_per_veh.toFixed(1)}s delay` : '';
      const queueInfo = res && res.queue_length_m > 0 ? ` | Queue: ${res.queue_length_m.toFixed(0)}m` : '';
      const closedInfo = isClosed ? ' [CLOSED]' : '';

      poly.bindTooltip(
        `<div style="font-family: inherit;"><strong>${l.name}</strong>${closedInfo}<br/><span style="color:#94A3B8;">V/C: ${vc.toFixed(2)} (${delayInfo}${queueInfo})</span></div>`,
        {
          sticky: true,
          direction: 'top',
          offset: [0, -10],
          className: 'leaflet-custom-tooltip',
        }
      );

      // Midpoint Road Name Badge (Rendered cleanly when route mode is inactive)
      if (!isRouteActive) {
        const midIdx = Math.floor(latLngs.length / 2);
        const midPoint = latLngs[midIdx];
        const roadBadge = L.divIcon({
          className: 'road-label-badge',
          html: `<div style="transform: translate(-50%, -50%); background: rgba(21, 29, 41, 0.92); border: 1px solid #293548; color: #E8EDF4; font-size: 9px; font-weight: 600; padding: 1.5px 5px; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.5); white-space: nowrap; pointer-events: none;">${l.name}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker(midPoint, { icon: roadBadge, interactive: false }).addTo(group);
      }
    });

    // 4. Directional Guidance Arrows along Selected Route ONLY
    if (selectedRoute && selectedRoute.geometry.length > 1) {
      const coords = selectedRoute.geometry;
      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const midLat = (p1[0] + p2[0]) / 2;
        const midLon = (p1[1] + p2[1]) / 2;
        const bearing = calcBearing(p1[0], p1[1], p2[0], p2[1]);

        const chevronIcon = L.divIcon({
          className: 'route-chevron',
          html: `<div style="transform: translate(-50%, -50%) rotate(${bearing}deg); color: #FFFFFF; font-size: 13px; line-height: 1; text-shadow: 0 0 4px #0B0F14; font-weight: 900; pointer-events: none;">▲</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        L.marker([midLat, midLon], { icon: chevronIcon, interactive: false }).addTo(group);
      }

      // Start Marker (Origin Pin A)
      const startCoord = coords[0];
      const startIcon = L.divIcon({
        className: 'route-start-pin',
        html: `
          <div style="transform: translate(-50%, -50%);" class="flex flex-col items-center">
            <div style="background: #10B981; color: #FFFFFF; font-size: 11px; font-weight: 800; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFFFFF; box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);">
              A
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(startCoord, { icon: startIcon, interactive: false })
        .bindTooltip(`<strong>Start: ${selectedRoute.origin_name}</strong>`, { direction: 'top', offset: [0, -12] })
        .addTo(group);

      // Destination Marker (Destination Pin B)
      const endCoord = coords[coords.length - 1];
      const endIcon = L.divIcon({
        className: 'route-end-pin',
        html: `
          <div style="transform: translate(-50%, -50%);" class="flex flex-col items-center">
            <div style="background: #EF4444; color: #FFFFFF; font-size: 11px; font-weight: 800; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFFFFF; box-shadow: 0 0 12px rgba(239, 68, 68, 0.8);">
              B
            </div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(endCoord, { icon: endIcon, interactive: false })
        .bindTooltip(`<strong>End: ${selectedRoute.destination_name}</strong>`, { direction: 'top', offset: [0, -12] })
        .addTo(group);
    }

    // 5. Junction Node Markers
    nodes.forEach((n) => {
      const isSig = n.is_signalized;
      const marker = L.circleMarker([n.lat, n.lon], {
        radius: isSig ? 6 : 4,
        fillColor: isSig ? '#F59E0B' : '#64748B',
        color: '#0B0F14',
        weight: 2,
        fillOpacity: 1,
      }).addTo(group);

      marker.bindTooltip(
        `<strong>${n.name}</strong>${isSig ? ' (Signal Controlled)' : ''}`,
        { sticky: true, direction: 'top', offset: [0, -6] }
      );
    });
  }, [links, nodes, linkResults, selectedLinkId, selectedRoute]);

  const activeLinkData = selectedLinkId ? linkResults[selectedLinkId] : null;

  // Find candidate routes that traverse the currently selected link
  const routesThroughSelectedLink = useMemo(() => {
    if (!selectedLinkId) return [];
    return routes.filter((r) => r.link_ids.includes(selectedLinkId));
  }, [routes, selectedLinkId]);

  // Find alternative routes with identical origin & destination as selectedRoute
  const alternativeRoutes = useMemo(() => {
    if (!selectedRoute) return [];
    return routes.filter(
      (r) =>
        r.origin_node_id === selectedRoute.origin_node_id &&
        r.destination_node_id === selectedRoute.destination_node_id
    );
  }, [routes, selectedRoute]);

  const getManeuverIcon = (maneuver: string) => {
    switch (maneuver) {
      case 'depart':
        return <Compass className="w-3.5 h-3.5 text-[#10B981]" />;
      case 'straight':
        return <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8]" />;
      case 'slight_right':
      case 'right':
      case 'sharp_right':
        return <CornerUpRight className="w-3.5 h-3.5 text-[#38BDF8]" />;
      case 'slight_left':
      case 'left':
      case 'sharp_left':
        return <CornerUpLeft className="w-3.5 h-3.5 text-[#38BDF8]" />;
      case 'arrive':
        return <Flag className="w-3.5 h-3.5 text-[#EF4444]" />;
      default:
        return <Navigation className="w-3.5 h-3.5 text-[#94A3B8]" />;
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-[#0B0F14]">
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#0B0F14]" />

      {/* Fallback notification if tile loading encounters network restriction */}
      {tileError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-[#1C2634] border border-amber-500/40 text-amber-300 px-3 py-1.5 rounded-lg text-xs shadow-lg flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Basemap tiles operating in cached mode. Network geometry and topology are active.</span>
        </div>
      )}

      {/* Traffic Congestion Legend (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 bg-[#151D29]/90 backdrop-blur-md border border-[#293548] p-2.5 rounded-lg shadow-xl text-xs space-y-1.5 pointer-events-auto max-w-[210px]">
        <div className="font-bold text-[#E8EDF4] text-[10px] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#293548] pb-1">
          <Activity className="w-3.5 h-3.5 text-[#10B981]" />
          <span>Volume / Capacity Status</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-3 h-2 bg-[#10B981] rounded-xs"></span>
          <span className="text-[#94A3B8]">&lt; 0.65 (Free flow)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-3 h-2 bg-[#F59E0B] rounded-xs"></span>
          <span className="text-[#94A3B8]">0.65 – 0.85 (Moderate)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-3 h-2 bg-[#EA580C] rounded-xs"></span>
          <span className="text-[#94A3B8]">0.85 – 1.00 (Heavy)</span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-3 h-2 bg-[#EF4444] rounded-xs"></span>
          <span className="text-[#EF4444] font-semibold">&ge; 1.0 (Queued)</span>
        </div>
      </div>

      {/* Active Route Mode Banner (Top-Center) */}
      {selectedRoute && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-[#151D29]/95 backdrop-blur-md border border-[#3B82F6]/50 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6] animate-pulse"></span>
            <span className="text-xs font-bold text-[#E8EDF4]">{selectedRoute.name}</span>
            <span className="text-[11px] text-[#94A3B8] font-mono">
              ({(selectedRoute.total_distance_m / 1000).toFixed(2)} km &bull;{' '}
              {Math.round(selectedRoute.modeled_travel_time_sec / 60)}m{' '}
              {Math.round(selectedRoute.modeled_travel_time_sec % 60)}s)
            </span>
          </div>
          <button
            onClick={() => onSelectRoute(null)}
            className="text-[#94A3B8] hover:text-[#E8EDF4] p-1 rounded-md hover:bg-[#1C2634] transition-all ml-1"
            title="Exit Route Mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating Route Details Panel (When a Route is Selected) */}
      {selectedRoute && (
        <div className="absolute top-16 right-4 z-20 bg-[#151D29]/95 backdrop-blur-md border border-[#293548] rounded-xl shadow-2xl w-88 max-w-[calc(100vw-2rem)] p-4 max-h-[calc(100%-5rem)] overflow-y-auto pointer-events-auto space-y-3.5">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#293548] pb-2.5">
            <div>
              <span className="text-[10px] font-bold tracking-wider uppercase text-[#38BDF8] bg-sky-950/60 border border-sky-800/50 px-1.5 py-0.5 rounded">
                Active Corridor Route
              </span>
              <h3 className="font-bold text-[#E8EDF4] text-sm mt-1 leading-tight">
                {selectedRoute.name}
              </h3>
            </div>
            <button
              onClick={() => onSelectRoute(null)}
              className="text-[#94A3B8] hover:text-[#E8EDF4] p-1 rounded-md hover:bg-[#1C2634] transition-all"
              title="Close Route Details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Metric Badges */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
              <span className="text-[#94A3B8] block text-[10px]">Distance</span>
              <span className="font-bold text-[#E8EDF4] font-mono">
                {(selectedRoute.total_distance_m / 1000).toFixed(2)} km
              </span>
            </div>
            <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
              <span className="text-[#94A3B8] block text-[10px]">Modeled Time</span>
              <span className="font-bold text-[#38BDF8] font-mono">
                {Math.round(selectedRoute.modeled_travel_time_sec / 60)}m{' '}
                {Math.round(selectedRoute.modeled_travel_time_sec % 60)}s
              </span>
            </div>
            <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
              <span className="text-[#94A3B8] block text-[10px]">Trip Delay</span>
              <span className="font-bold text-[#EF4444] font-mono">
                +{selectedRoute.delay_sec.toFixed(0)}s
              </span>
            </div>
          </div>

          {/* Alternative Routes Selector (If multiple valid routes exist for this OD pair) */}
          {alternativeRoutes.length > 1 && (
            <div>
              <span className="text-[10px] uppercase font-bold text-[#94A3B8] tracking-wider block mb-1.5">
                Available Alternative Routes ({alternativeRoutes.length})
              </span>
              <div className="space-y-1.5">
                {alternativeRoutes.map((alt) => {
                  const isCurrent = alt.id === selectedRoute.id;
                  return (
                    <button
                      key={alt.id}
                      onClick={() => onSelectRoute(alt)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs font-medium border transition-all text-left ${
                        isCurrent
                          ? 'bg-blue-950/70 border-[#3B82F6] text-[#E8EDF4]'
                          : 'bg-[#101722] border-[#293548] text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isCurrent ? 'bg-[#3B82F6]' : 'bg-[#64748B]'
                          }`}
                        ></span>
                        <span>{alt.name.split(':')[0]}</span>
                      </div>
                      <span className="font-mono text-[11px]">
                        {(alt.total_distance_m / 1000).toFixed(2)} km &bull;{' '}
                        {Math.round(alt.modeled_travel_time_sec / 60)}m{' '}
                        {Math.round(alt.modeled_travel_time_sec % 60)}s
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Turn-by-Turn Guidance Accordion */}
          <div className="border border-[#293548] rounded-lg overflow-hidden bg-[#101722]">
            <button
              onClick={() => setIsTurnDetailsOpen(!isTurnDetailsOpen)}
              className="w-full flex items-center justify-between p-2.5 bg-[#1C2634] text-xs font-semibold text-[#E8EDF4]"
            >
              <div className="flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Turn-by-Turn Guidance ({selectedRoute.turn_instructions.length} steps)</span>
              </div>
              <span className="text-[#94A3B8] text-[10px]">
                {isTurnDetailsOpen ? 'Hide' : 'Show'}
              </span>
            </button>

            {isTurnDetailsOpen && (
              <div className="divide-y divide-[#293548] max-h-56 overflow-y-auto">
                {selectedRoute.turn_instructions.map((step) => (
                  <div key={step.step_number} className="p-2.5 flex items-start gap-2.5 text-xs">
                    <div className="p-1 rounded bg-[#151D29] border border-[#293548] shrink-0 mt-0.5">
                      {getManeuverIcon(step.maneuver)}
                    </div>
                    <div className="flex-1 leading-snug">
                      <p className="text-[#E8EDF4] font-medium">{step.instruction}</p>
                      {step.distance_m > 0 && (
                        <p className="text-[10px] text-[#94A3B8] mt-0.5 font-mono">
                          {step.distance_m.toFixed(0)}m &bull; ~{step.travel_time_sec.toFixed(0)}s
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Selected Road Inspector (When a Road Link is Selected & No Route Active) */}
      {activeLinkData && !selectedRoute && (
        <div
          className={`absolute top-4 right-4 z-20 bg-[#151D29]/95 backdrop-blur-md border border-[#293548] rounded-xl shadow-2xl transition-all duration-200 pointer-events-auto ${
            isInspectorMinimized
              ? 'w-56 p-2.5'
              : 'w-84 max-w-[calc(100vw-2rem)] p-4 max-h-[calc(100%-2rem)] overflow-y-auto'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#293548] pb-2 mb-2.5">
            <div className="pr-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] bg-[#101722] border border-[#293548] px-1.5 py-0.5 rounded">
                {activeLinkData.highway_type} road
              </span>
              <h4 className="font-bold text-[#E8EDF4] text-xs sm:text-sm mt-0.5 leading-tight">
                {activeLinkData.link_name}
              </h4>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsInspectorMinimized(!isInspectorMinimized)}
                className="text-[#94A3B8] hover:text-[#E8EDF4] p-1 rounded hover:bg-[#1C2634] transition-all"
                title={isInspectorMinimized ? 'Expand' : 'Minimize'}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSelectLink('')}
                className="text-[#94A3B8] hover:text-[#E8EDF4] p-1 rounded hover:bg-[#1C2634] transition-all font-bold"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isInspectorMinimized && (
            <>
              {/* Performance Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[#94A3B8] block text-[10px]">Volume / Capacity</span>
                  <span className="font-bold text-[#E8EDF4]">
                    {activeLinkData.volume_vph.toFixed(0)} / {activeLinkData.capacity_vph.toFixed(0)}{' '}
                    <span className="text-[10px] font-normal text-[#94A3B8]">vph</span>
                  </span>
                </div>
                <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[#94A3B8] block text-[10px]">V/C Saturation</span>
                  <span
                    className={`font-bold ${
                      activeLinkData.vc_ratio >= 1.0 ? 'text-[#EF4444]' : 'text-[#E8EDF4]'
                    }`}
                  >
                    {activeLinkData.vc_ratio.toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[#94A3B8] block text-[10px]">Modeled Speed</span>
                  <span className="font-bold text-[#E8EDF4]">
                    {activeLinkData.speed_kmh.toFixed(1)} km/h
                  </span>
                </div>
                <div className="bg-[#101722] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[#94A3B8] block text-[10px]">Queue Length</span>
                  <span
                    className={`font-bold ${
                      activeLinkData.queue_length_m > 0 ? 'text-[#EF4444]' : 'text-[#E8EDF4]'
                    }`}
                  >
                    {activeLinkData.queue_length_m.toFixed(0)}m{' '}
                    <span className="text-[10px] text-[#94A3B8]">
                      ({activeLinkData.queue_vehicles.toFixed(0)} veh)
                    </span>
                  </span>
                </div>
              </div>

              {/* Status / Direct Intervention Tag */}
              {activeLinkData.is_directly_modified && (
                <div className="mb-3 p-2 bg-emerald-950/60 border border-emerald-800/60 rounded-lg text-emerald-300 text-[11px] font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
                  <span>{activeLinkData.intervention_label || 'Direct Intervention Applied'}</span>
                </div>
              )}

              {/* Spillover Notification */}
              {!activeLinkData.is_directly_modified && activeAlternative !== 'BASELINE' && (
                <div
                  className={`mb-3 p-2 rounded-lg text-[11px] border ${
                    activeLinkData.spillover_status === 'newly_congested'
                      ? 'bg-red-950/60 border-red-800/60 text-red-300'
                      : activeLinkData.spillover_status === 'deteriorated'
                      ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                      : activeLinkData.spillover_status === 'improved'
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-[#101722] border-[#293548] text-[#94A3B8]'
                  }`}
                >
                  <div className="font-semibold capitalize flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 shrink-0" />
                    <span>Spillover: {activeLinkData.spillover_status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-[10px] mt-0.5 leading-snug">
                    {activeLinkData.spillover_explanation}
                  </p>
                </div>
              )}

              {/* Action 1: Analyse Route through this Road */}
              {routesThroughSelectedLink.length > 0 && (
                <div className="mb-2">
                  <button
                    onClick={() => onSelectRoute(routesThroughSelectedLink[0])}
                    className="w-full flex items-center justify-center gap-1.5 bg-[#1C2634] hover:bg-[#293548] text-[#38BDF8] border border-sky-800/40 py-2 px-3 rounded-lg text-xs font-semibold shadow-xs transition-all"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Analyse Route through this Road ({routesThroughSelectedLink.length})</span>
                  </button>
                </div>
              )}

              {/* Action 2: Configure Intervention on this road */}
              {onAddInterventionForLink && (
                <button
                  onClick={() => onAddInterventionForLink(activeLinkData.link_id)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#10B981] hover:bg-emerald-600 text-[#0B0F14] py-2 px-3 rounded-lg text-xs font-bold shadow-sm transition-all"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Configure Intervention on this Road</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
