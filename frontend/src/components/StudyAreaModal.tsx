import React, { useState } from 'react';
import {
  MapPin,
  Search,
  DownloadCloud,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  ArrowRight,
  Save,
  Globe,
  Loader2,
} from 'lucide-react';
import {
  searchOSMLocation,
  fetchOSMStudyArea,
  saveStudyArea,
  type FetchOSMStudyAreaResponse,
} from '../api/client';
import type { NetworkNode, NetworkLink, TrafficDemandScenario } from '../types/traffic';

interface StudyAreaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadStudyArea: (
    nodes: NetworkNode[],
    links: NetworkLink[],
    demand: TrafficDemandScenario,
    meta: Record<string, any>
  ) => void;
}

export const StudyAreaModal: React.FC<StudyAreaModalProps> = ({
  isOpen,
  onClose,
  onLoadStudyArea,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);

  // Ingestion state
  const [isFetchingOSM, setIsFetchingOSM] = useState(false);
  const [osmFetchProgress, setOsmFetchProgress] = useState<string>('');
  const [fetchedData, setFetchedData] = useState<FetchOSMStudyAreaResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Custom metadata form
  const [areaName, setAreaName] = useState('');
  const [city, setCity] = useState('');
  const [problemStatement, setProblemStatement] = useState('Peak hour dispersal bottleneck');
  const [objective, setObjective] = useState('Reduce queue delay and neighbor spillover');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setErrorMessage(null);
    setSelectedResult(null);
    setFetchedData(null);
    try {
      const res = await searchOSMLocation(searchQuery);
      setSearchResults(res.results || []);
      if (!res.results || res.results.length === 0) {
        setErrorMessage(`No OpenStreetMap locations found for "${searchQuery}".`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Search failed. Check network connection.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectResult = (item: any) => {
    setSelectedResult(item);
    const parts = item.display_name.split(',');
    setAreaName(parts[0].trim());
    setCity(parts.length > 2 ? parts[2].trim() : parts[1].trim());
    setFetchedData(null);
    setErrorMessage(null);
  };

  const handleFetchOSM = async () => {
    if (!selectedResult) return;
    setIsFetchingOSM(true);
    setErrorMessage(null);
    setFetchedData(null);

    try {
      setOsmFetchProgress('Contacting OpenStreetMap Overpass servers...');
      // boundingbox in Nominatim is [south, north, west, east] or similar
      const bbox = selectedResult.boundingbox;
      let south = parseFloat(bbox[0]);
      let north = parseFloat(bbox[1]);
      let west = parseFloat(bbox[2]);
      let east = parseFloat(bbox[3]);

      // If bounding box is too large (e.g. whole state/city), clamp to ~1.2km radius around center
      const lat = parseFloat(selectedResult.lat);
      const lon = parseFloat(selectedResult.lon);
      const deltaLat = north - south;
      const deltaLon = east - west;

      if (deltaLat > 0.02 || deltaLon > 0.02) {
        south = lat - 0.007;
        north = lat + 0.007;
        west = lon - 0.007;
        east = lon + 0.007;
      }

      setOsmFetchProgress('Downloading highway ways and intersection nodes...');
      const result = await fetchOSMStudyArea({
        south,
        west,
        north,
        east,
        area_name: areaName || 'Custom Study Area',
        city: city || 'Urban Corridor',
        problem_statement: problemStatement,
        objective: objective,
      });

      setFetchedData(result);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message ||
          'Failed to construct connected road graph from OpenStreetMap. Please select an urban area with mapped vehicular roadways.'
      );
    } finally {
      setIsFetchingOSM(false);
      setOsmFetchProgress('');
    }
  };

  const handleLoadAndApply = async (andSave: boolean = false) => {
    if (!fetchedData) return;
    const studyId = `custom_${Date.now()}`;
    const meta = {
      id: studyId,
      name: areaName || fetchedData.area_name,
      city: city || fetchedData.city,
      problem_statement: problemStatement,
      objective: objective,
      center: fetchedData.center,
      zoom: fetchedData.default_zoom || 16,
      is_custom: true,
    };

    if (andSave) {
      setIsSaving(true);
      try {
        await saveStudyArea({
          id: studyId,
          name: meta.name,
          city: meta.city,
          problem_statement: problemStatement,
          objective: objective,
          nodes: fetchedData.nodes,
          links: fetchedData.links,
          demand: fetchedData.demand,
          metadata: meta,
        });
      } catch (err) {
        console.error('Failed to save study area:', err);
      } finally {
        setIsSaving(false);
      }
    }

    onLoadStudyArea(fetchedData.nodes, fetchedData.links, fetchedData.demand, meta);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto select-none font-sans">
      <div className="bg-[#151D29] border border-[#293548] rounded-2xl shadow-2xl max-w-2xl w-full p-6 text-[#E8EDF4] max-h-[90vh] overflow-y-auto space-y-5">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-[#293548] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center">
              <Globe className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                Dynamic Study Area Ingestion
              </span>
              <h2 className="text-lg font-bold text-[#E8EDF4] mt-0.5">
                Import Real-World OpenStreetMap Network
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Location Search Form */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] block">
            1. Search City, Sector, Metro Station or Crossroad
          </label>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="e.g., Connaught Place New Delhi, Indirapuram Ghaziabad, HSR Layout..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#101722] border border-[#293548] rounded-xl text-xs text-[#E8EDF4] focus:outline-none focus:border-blue-500 placeholder-[#64748B]"
              />
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              <span>Search</span>
            </button>
          </form>

          {/* Search Results List */}
          {searchResults.length > 0 && !fetchedData && (
            <div className="bg-[#101722] border border-[#293548] rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-[#293548]">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectResult(item)}
                  className={`p-2.5 text-xs cursor-pointer transition-colors flex items-center justify-between ${
                    selectedResult === item
                      ? 'bg-blue-950/60 border-l-4 border-blue-500 text-blue-200'
                      : 'hover:bg-[#1C2634] text-[#94A3B8]'
                  }`}
                >
                  <div className="pr-2 leading-tight">
                    <strong className="text-[#E8EDF4] block text-xs">{item.display_name.split(',')[0]}</strong>
                    <span className="text-[10px] text-[#64748B] truncate block max-w-md">
                      {item.display_name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748B] shrink-0">
                    {parseFloat(item.lat).toFixed(4)}, {parseFloat(item.lon).toFixed(4)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Error State Banner */}
        {errorMessage && (
          <div className="bg-red-950/60 border border-red-800/80 p-3 rounded-xl flex items-start gap-2.5 text-xs text-red-300">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-red-200">OSM Extraction Issue</span>
              <p className="text-[11px] leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Step 2: Trigger OSM Overpass Extraction */}
        {selectedResult && !fetchedData && (
          <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E8EDF4]">
                Target Area: {areaName} ({city})
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-900/60">
                Ready for Extraction
              </span>
            </div>

            <button
              onClick={handleFetchOSM}
              disabled={isFetchingOSM}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
            >
              {isFetchingOSM ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{osmFetchProgress || 'Fetching from OpenStreetMap...'}</span>
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" />
                  <span>Download &amp; Build Real Road Network</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Step 3: Verified Extracted Network Preview */}
        {fetchedData && (
          <div className="space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-800/70 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Network Topologically Connected &amp; Validated</span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  IRC:106 Calibrated
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[10px] text-[#94A3B8] block">Intersections</span>
                  <strong className="text-base text-[#E8EDF4]">{fetchedData.node_count}</strong>
                </div>
                <div className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[10px] text-[#94A3B8] block">Road Links</span>
                  <strong className="text-base text-[#E8EDF4]">{fetchedData.link_count}</strong>
                </div>
                <div className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                  <span className="text-[10px] text-[#94A3B8] block">OD Demand Flows</span>
                  <strong className="text-base text-[#E8EDF4]">
                    {fetchedData.demand.od_flows.length} Pairs
                  </strong>
                </div>
              </div>

              {fetchedData.warnings && fetchedData.warnings.length > 0 && (
                <div className="text-[10px] text-amber-300/90 pt-1 space-y-0.5">
                  {fetchedData.warnings.map((w, idx) => (
                    <div key={idx}>&bull; {w}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to refine scenario details */}
            <div className="bg-[#101722] border border-[#293548] rounded-xl p-3.5 space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Corridor Study Name
                </label>
                <input
                  type="text"
                  value={areaName}
                  onChange={(e) => setAreaName(e.target.value)}
                  className="w-full bg-[#151D29] border border-[#293548] rounded-lg p-2 text-xs text-[#E8EDF4] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Problem Context
                </label>
                <input
                  type="text"
                  value={problemStatement}
                  onChange={(e) => setProblemStatement(e.target.value)}
                  className="w-full bg-[#151D29] border border-[#293548] rounded-lg p-2 text-xs text-[#E8EDF4] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block mb-1">
                  Planning Objective
                </label>
                <input
                  type="text"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full bg-[#151D29] border border-[#293548] rounded-lg p-2 text-xs text-[#E8EDF4] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => handleLoadAndApply(false)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-4 h-4" />
                <span>Load into Simulation Workspace</span>
              </button>

              <button
                onClick={() => handleLoadAndApply(true)}
                disabled={isSaving}
                className="bg-[#101722] hover:bg-[#1C2634] border border-[#293548] text-emerald-400 py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save & Load'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
