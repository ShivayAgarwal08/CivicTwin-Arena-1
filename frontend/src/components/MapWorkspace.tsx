import React, { useEffect, useRef, useState } from 'react';
import type {
  NetworkNode,
  NetworkLink,
  LinkPerformanceResult,
  AuthorType,
} from '../types/traffic';
import { Layers, AlertTriangle, CheckCircle, Info, PlusCircle, Gauge, Activity } from 'lucide-react';
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
  const [hoveredLink, setHoveredLink] = useState<LinkPerformanceResult | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: center,
      zoom: zoom,
      zoomControl: true,
    });

    // High quality light CartoDB Voyager tiles (clean, professional, non-distracting)
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    layerGroupRef.current = layerGroup;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update center & zoom when preset changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom, { animate: true });
    }
  }, [center, zoom]);

  // Render Polylines & Markers whenever links or active alternative changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    // Color mapper for congestion level
    const getLinkColor = (vc: number) => {
      if (vc >= 1.0) return '#DC2626'; // Red: Oversaturated
      if (vc >= 0.85) return '#EA580C'; // Orange: Heavy
      if (vc >= 0.65) return '#D97706'; // Amber: Moderate
      return '#16A34A'; // Green: Free flow
    };

    // Draw links
    links.forEach((l) => {
      const res = linkResults[l.id];
      const vc = res ? res.vc_ratio : (l.base_capacity_vph ? 0.5 : 0.0);
      const isSelected = selectedLinkId === l.id;
      const isDirect = res ? res.is_directly_modified : false;
      const color = getLinkColor(vc);

      // Convert GeoJSON [[lon, lat], ...] to Leaflet [[lat, lon], ...]
      const latLngs: [number, number][] = l.coordinates.map((c) => [c[1], c[0]]);
      if (latLngs.length < 2) return;

      // Outer glow for selected or modified links
      if (isSelected || isDirect) {
        L.polyline(latLngs, {
          color: isDirect ? '#1B4332' : '#2563EB',
          weight: 12,
          opacity: 0.45,
          lineCap: 'round',
        }).addTo(group);
      }

      // Main corridor polyline
      const poly = L.polyline(latLngs, {
        color: color,
        weight: isSelected ? 8 : 6,
        opacity: 0.9,
        dashArray: vc >= 1.0 ? '8, 6' : undefined,
      }).addTo(group);

      poly.on('click', () => {
        onSelectLink(l.id);
      });

      poly.on('mouseover', () => {
        if (res) setHoveredLink(res);
      });

      poly.on('mouseout', () => {
        setHoveredLink(null);
      });

      // Tooltip
      const delayInfo = res ? `${res.delay_sec_per_veh.toFixed(1)}s delay` : '';
      const queueInfo = res && res.queue_length_m > 0 ? ` | Queue: ${res.queue_length_m.toFixed(0)}m` : '';
      poly.bindTooltip(
        `<strong>${l.name}</strong><br/>V/C: ${vc.toFixed(2)} (${delayInfo}${queueInfo})`,
        { sticky: true, className: 'leaflet-custom-tooltip' }
      );
    });

    // Draw intersection nodes
    nodes.forEach((n) => {
      const isSig = n.is_signalized;
      const marker = L.circleMarker([n.lat, n.lon], {
        radius: isSig ? 6 : 4,
        fillColor: isSig ? '#D97706' : '#64748B',
        color: '#FFFFFF',
        weight: 2,
        fillOpacity: 1,
      }).addTo(group);

      marker.bindTooltip(
        `<strong>${n.name}</strong>${isSig ? ' (Traffic Signal Controlled)' : ''}`,
        { sticky: true }
      );
    });
  }, [links, nodes, linkResults, selectedLinkId]);

  const activeLinkData = selectedLinkId ? linkResults[selectedLinkId] : null;

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Map Surface */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Legend Overlay */}
      <div className="absolute top-4 left-4 z-10 bg-white/95 backdrop-blur-sm border border-[#E5DEC9] p-2.5 rounded-lg shadow-sm text-xs space-y-1.5 pointer-events-auto max-w-[200px]">
        <div className="font-bold text-[#1F2421] text-[11px] uppercase tracking-wide flex items-center gap-1.5 border-b border-[#E5DEC9] pb-1">
          <Activity className="w-3.5 h-3.5 text-[#1B4332]" />
          <span>V/C Congestion Legend</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#16A34A] rounded-sm"></span>
          <span className="text-[#1F2421]">V/C &lt; 0.65 (Free flow)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#D97706] rounded-sm"></span>
          <span className="text-[#1F2421]">0.65 – 0.85 (Moderate)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#EA580C] rounded-sm"></span>
          <span className="text-[#1F2421]">0.85 – 1.00 (Heavy)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-1.5 bg-[#DC2626] rounded-sm border border-red-300"></span>
          <span className="text-[#DC2626] font-semibold">V/C &ge; 1.0 (Queued Bottleneck)</span>
        </div>
      </div>

      {/* Selected Link Inspector Floating Card */}
      {activeLinkData && (
        <div className="absolute bottom-6 left-6 z-10 bg-white/95 backdrop-blur-sm border border-[#E5DEC9] p-4 rounded-xl shadow-lg w-80 text-xs animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-start justify-between border-b border-[#E5DEC9] pb-2 mb-2.5">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#667085] bg-[#F4F0E8] px-1.5 py-0.5 rounded">
                {activeLinkData.highway_type} road
              </span>
              <h4 className="font-bold text-[#1F2421] text-sm mt-0.5">{activeLinkData.link_name}</h4>
            </div>
            <button
              onClick={() => onSelectLink('')}
              className="text-[#667085] hover:text-[#1F2421] text-sm font-bold"
            >
              ✕
            </button>
          </div>

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
              <span className="text-[#667085] block text-[10px]">Average Delay</span>
              <span className="font-bold text-[#1F2421]">
                {activeLinkData.delay_sec_per_veh.toFixed(1)}s / veh
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

          {/* Spillover or Modification badge */}
          {activeLinkData.is_directly_modified && (
            <div className="mb-3 p-2 bg-[#E8F5E9] border border-[#C8E6C9] rounded text-[#1B4332] text-[11px] font-medium flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-[#2E7D32]" />
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
                <AlertTriangle className="w-3 h-3" />
                <span>Spillover: {activeLinkData.spillover_status.replace('_', ' ')}</span>
              </div>
              <p className="text-[10px] mt-0.5">{activeLinkData.spillover_explanation}</p>
            </div>
          )}

          {/* Add Intervention on this road action button */}
          {onAddInterventionForLink && (
            <button
              onClick={() => onAddInterventionForLink(activeLinkData.link_id)}
              className="w-full flex items-center justify-center gap-1.5 bg-[#1B4332] hover:bg-[#143225] text-white py-1.5 px-3 rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Configure Intervention on this Road</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
