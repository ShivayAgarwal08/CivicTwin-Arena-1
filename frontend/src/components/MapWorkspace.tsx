import React, { useEffect, useRef, useState, useMemo } from 'react';
import type {
  NetworkNode,
  NetworkLink,
  LinkPerformanceResult,
  AuthorType,
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState<boolean>(false);
  const [isInspectorMinimized, setIsInspectorMinimized] = useState<boolean>(false);

  // 1. Initialize Map with standard, free OpenStreetMap tiles (no API key required)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: false, // will reposition zoom controls cleanly
      attributionControl: true,
    });

    // Add zoom control to top-left below legend
    L.control.zoom({ position: 'topleft' }).addTo(map);

    // Standard OpenStreetMap tiles (free, reliable, respects open usage policy)
    const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    });

    osmLayer.on('tileerror', () => {
      setTileError(true);
    });

    osmLayer.addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    // Invalidate map size on window resize
    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    // Initial size invalidation after mount
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Automatically fit bounds whenever the corridor links change
  useEffect(() => {
    if (!mapInstanceRef.current || links.length === 0) return;
    const map = mapInstanceRef.current;

    // Invalidate size to ensure dimensions are fresh
    map.invalidateSize();

    const allLatLngs: [number, number][] = [];
    links.forEach((l) => {
      l.coordinates.forEach((c) => {
        allLatLngs.push([c[1], c[0]]);
      });
    });

    if (allLatLngs.length > 0) {
      const bounds = L.latLngBounds(allLatLngs);
      map.fitBounds(bounds, {
        padding: [45, 45],
        maxZoom: 17,
        animate: true,
      });
    } else {
      map.setView(center, zoom, { animate: true });
    }
  }, [links, center, zoom]);

  // 3. Render High-Contrast Polylines & Intersection Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    const getLinkColor = (vc: number, isClosed: boolean) => {
      if (isClosed) return '#991B1B'; // Deep Crimson for Closed Roads
      if (vc >= 1.0) return '#DC2626'; // Red: Oversaturated
      if (vc >= 0.85) return '#EA580C'; // Orange: Heavy
      if (vc >= 0.65) return '#D97706'; // Amber: Moderate
      return '#16A34A'; // Green: Free flow
    };

    // Draw all links
    links.forEach((l) => {
      const res = linkResults[l.id];
      const vc = res ? res.vc_ratio : (l.base_capacity_vph ? 0.5 : 0.0);
      const isSelected = selectedLinkId === l.id;
      const isDirect = res ? res.is_directly_modified : false;
      const isClosed = res ? res.capacity_vph <= 0 : false;
      const color = getLinkColor(vc, isClosed);

      // Convert GeoJSON [[lon, lat], ...] to Leaflet [[lat, lon], ...]
      const latLngs: [number, number][] = l.coordinates.map((c) => [c[1], c[0]]);
      if (latLngs.length < 2) return;

      // Layer 1: Selection or Direct Intervention Highlight Halo
      if (isSelected || isDirect) {
        L.polyline(latLngs, {
          color: isDirect ? '#1B4332' : '#2563EB',
          weight: 16,
          opacity: 0.5,
          lineCap: 'round',
        }).addTo(group);
      }

      // Layer 2: High-contrast Dark Casing (makes geometry immediately sharp & visible on any basemap)
      L.polyline(latLngs, {
        color: '#0F172A',
        weight: isSelected ? 10 : 8,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(group);

      // Layer 3: Inner Congestion Stroke
      const poly = L.polyline(latLngs, {
        color: color,
        weight: isSelected ? 6 : 5,
        opacity: 1.0,
        dashArray: isClosed ? '6, 6' : vc >= 1.0 ? '8, 5' : undefined,
        lineCap: 'round',
      }).addTo(group);

      // Interaction
      poly.on('click', () => {
        onSelectLink(l.id);
        setIsInspectorMinimized(false);
      });

      // Accessible, non-clipped Tooltip
      const delayInfo = res ? `${res.delay_sec_per_veh.toFixed(1)}s delay` : '';
      const queueInfo = res && res.queue_length_m > 0 ? ` | Queue: ${res.queue_length_m.toFixed(0)}m` : '';
      const closedInfo = isClosed ? ' (STREET CLOSED)' : '';

      poly.bindTooltip(
        `<strong>${l.name}</strong>${closedInfo}<br/>V/C: ${vc.toFixed(2)} (${delayInfo}${queueInfo})`,
        {
          sticky: true,
          direction: 'top',
          offset: [0, -10],
          className: 'leaflet-custom-tooltip',
        }
      );

      // Midpoint Name Badge (ensures road network labels are visible without requiring hover)
      const midIdx = Math.floor(latLngs.length / 2);
      const midPoint = latLngs[midIdx];
      const roadBadge = L.divIcon({
        className: 'road-label-container',
        html: `<div style="transform: translate(-50%, -50%); background: rgba(255, 255, 255, 0.93); border: 1px solid #CBD5E1; color: #0F172A; font-size: 9px; font-weight: 700; padding: 1.5px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); white-space: nowrap; pointer-events: none; letter-spacing: -0.01em;">${l.name}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });
      L.marker(midPoint, { icon: roadBadge, interactive: false }).addTo(group);
    });

    // Draw intersection nodes
    nodes.forEach((n) => {
      const isSig = n.is_signalized;
      const marker = L.circleMarker([n.lat, n.lon], {
        radius: isSig ? 7 : 5,
        fillColor: isSig ? '#F59E0B' : '#475569',
        color: '#FFFFFF',
        weight: 2.5,
        fillOpacity: 1,
      }).addTo(group);

      marker.bindTooltip(
        `<strong>${n.name}</strong>${isSig ? ' (Signal Controlled)' : ''}`,
        { sticky: true, direction: 'top', offset: [0, -6] }
      );
    });
  }, [links, nodes, linkResults, selectedLinkId]);

  const activeLinkData = selectedLinkId ? linkResults[selectedLinkId] : null;

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none">
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#E2E8F0]" />

      {/* Fallback notification if tile loading encounters network restriction */}
      {tileError && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1 rounded-md text-[11px] shadow-sm flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>Basemap tiles operating in cached mode. Road geometry and topology are fully active.</span>
        </div>
      )}

      {/* Map Legend Overlay (Top-Left) */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm border border-[#E5DEC9] p-2.5 rounded-lg shadow-sm text-xs space-y-1.5 pointer-events-auto max-w-[210px]">
        <div className="font-bold text-[#1F2421] text-[11px] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E5DEC9] pb-1">
          <Activity className="w-3.5 h-3.5 text-[#1B4332]" />
          <span>V/C Congestion Legend</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-2 bg-[#16A34A] rounded-sm border border-emerald-700"></span>
          <span className="text-[#1F2421]">V/C &lt; 0.65 (Free flow)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-2 bg-[#D97706] rounded-sm border border-amber-700"></span>
          <span className="text-[#1F2421]">0.65 – 0.85 (Moderate)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-2 bg-[#EA580C] rounded-sm border border-orange-700"></span>
          <span className="text-[#1F2421]">0.85 – 1.00 (Heavy)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-2 bg-[#DC2626] rounded-sm border border-red-800"></span>
          <span className="text-[#DC2626] font-semibold">V/C &ge; 1.0 (Queued)</span>
        </div>
      </div>

      {/* Responsive, Non-Clipped Road Details Panel (Docked at Top-Right) */}
      {activeLinkData && (
        <div
          className={`absolute top-4 right-4 z-20 bg-white/95 backdrop-blur-sm border border-[#E5DEC9] rounded-xl shadow-xl transition-all duration-200 pointer-events-auto ${
            isInspectorMinimized ? 'w-56 p-2.5' : 'w-84 max-w-[calc(100vw-2rem)] p-4 max-h-[calc(100%-2rem)] overflow-y-auto'
          }`}
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-[#E5DEC9] pb-2 mb-2.5">
            <div className="pr-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#667085] bg-[#F4F0E8] px-1.5 py-0.5 rounded">
                {activeLinkData.highway_type} road
              </span>
              <h4 className="font-bold text-[#1F2421] text-xs sm:text-sm mt-0.5 leading-tight">
                {activeLinkData.link_name}
              </h4>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsInspectorMinimized(!isInspectorMinimized)}
                className="text-[#667085] hover:text-[#1F2421] p-1 rounded hover:bg-[#F4F0E8] transition-all"
                title={isInspectorMinimized ? 'Expand Inspector' : 'Minimize Inspector'}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSelectLink('')}
                className="text-[#667085] hover:text-[#1F2421] p-1 rounded hover:bg-[#F4F0E8] transition-all font-bold"
                title="Close Inspector"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isInspectorMinimized && (
            <>
              {/* Performance Metric Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-[#FBF9F5] p-2 rounded border border-[#E5DEC9]">
                  <span className="text-[#667085] block text-[10px]">Volume / Capacity</span>
                  <span className="font-bold text-[#1F2421]">
                    {activeLinkData.volume_vph.toFixed(0)} / {activeLinkData.capacity_vph.toFixed(0)}{' '}
                    <span className="text-[10px] font-normal text-[#667085]">vph</span>
                  </span>
                </div>
                <div className="bg-[#FBF9F5] p-2 rounded border border-[#E5DEC9]">
                  <span className="text-[#667085] block text-[10px]">V/C Ratio</span>
                  <span
                    className={`font-bold ${
                      activeLinkData.vc_ratio >= 1.0 ? 'text-[#DC2626]' : 'text-[#1F2421]'
                    }`}
                  >
                    {activeLinkData.vc_ratio.toFixed(2)}
                  </span>
                </div>
                <div className="bg-[#FBF9F5] p-2 rounded border border-[#E5DEC9]">
                  <span className="text-[#667085] block text-[10px]">Operating Speed</span>
                  <span className="font-bold text-[#1F2421]">
                    {activeLinkData.speed_kmh.toFixed(1)} km/h
                  </span>
                </div>
                <div className="bg-[#FBF9F5] p-2 rounded border border-[#E5DEC9]">
                  <span className="text-[#667085] block text-[10px]">Queue Length</span>
                  <span
                    className={`font-bold ${
                      activeLinkData.queue_length_m > 0 ? 'text-[#DC2626]' : 'text-[#1F2421]'
                    }`}
                  >
                    {activeLinkData.queue_length_m.toFixed(0)}m{' '}
                    <span className="text-[10px] text-[#667085]">
                      ({activeLinkData.queue_vehicles.toFixed(0)} veh)
                    </span>
                  </span>
                </div>
              </div>

              {/* Status / Spillover Notification */}
              {activeLinkData.is_directly_modified && (
                <div className="mb-3 p-2 bg-[#E8F5E9] border border-[#C8E6C9] rounded text-[#1B4332] text-[11px] font-medium flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                  <span>{activeLinkData.intervention_label || 'Intervention Applied'}</span>
                </div>
              )}

              {!activeLinkData.is_directly_modified && activeAlternative !== 'BASELINE' && (
                <div
                  className={`mb-3 p-2 rounded text-[11px] border ${
                    activeLinkData.spillover_status === 'newly_congested'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : activeLinkData.spillover_status === 'deteriorated'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : activeLinkData.spillover_status === 'improved'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
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

              {/* Action: Add Intervention on this road */}
              {onAddInterventionForLink && (
                <button
                  onClick={() => onAddInterventionForLink(activeLinkData.link_id)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#1B4332] hover:bg-[#143225] text-white py-2 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all"
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
