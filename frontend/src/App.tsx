import React, { useState, useEffect } from 'react';
import type {
  LocationPresetSummary,
  NetworkNode,
  NetworkLink,
  TrafficDemandScenario,
  Proposal,
  ComparisonReport,
  AuthorType,
  LinkPerformanceResult,
  AlternativeResult,
  NetworkRoute,
} from './types/traffic';
import {
  fetchPresets,
  fetchPresetDetail,
  fetchPresetRoutes,
  generateAIProposal,
  compareThreeAlternatives,
  searchOSMLocation,
} from './api/client';
import { ScenarioHeader } from './components/ScenarioHeader';
import { MapWorkspace } from './components/MapWorkspace';
import { ProposalBuilder } from './components/ProposalBuilder';
import { AIProposalCard } from './components/AIProposalCard';
import { ComparisonTable } from './components/ComparisonTable';
import { ComparisonCharts } from './components/ComparisonCharts';
import { SpilloverInspector } from './components/SpilloverInspector';
import { DecisionReportModal } from './components/DecisionReportModal';
import { StudyAreaModal } from './components/StudyAreaModal';
import { AssumptionsModal } from './components/AssumptionsModal';
import {
  Table,
  BarChart2,
  ShieldAlert,
  FileCheck,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
  MapPin,
  Clock,
  Sparkles,
  Navigation,
  Compass,
  Sliders,
  CornerDownRight,
  CornerUpRight,
  CornerUpLeft,
  ArrowRight,
  Flag,
  Share2,
  Activity,
  Cpu,
  Building2,
  CheckCircle2,
} from 'lucide-react';

type SidebarTab = 'overview' | 'routes' | 'builder' | 'matrix' | 'spillover';

export const App: React.FC = () => {
  const [presets, setPresets] = useState<LocationPresetSummary[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('jiit_sec128_noida');
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [demand, setDemand] = useState<TrafficDemandScenario | null>(null);
  const [presetMeta, setPresetMeta] = useState<any>(null);

  // Routing State
  const [routes, setRoutes] = useState<NetworkRoute[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<NetworkRoute | null>(null);

  // Active alternative currently viewed on the map ('BASELINE' | 'HUMAN' | 'AI')
  const [activeAlternative, setActiveAlternative] = useState<AuthorType>('BASELINE');

  // Baseline evaluation result
  const [baselineResult, setBaselineResult] = useState<AlternativeResult | null>(null);

  // Human Proposal
  const [humanProposal, setHumanProposal] = useState<Proposal>({
    id: 'human_proposal',
    author: 'HUMAN',
    title: 'My Proposal: Offline Pick-up Bay & Gate Flow',
    description: 'Construct a designated curbside pick-up bay outside college gate to clear friction.',
    interventions: [
      {
        intervention_type: 'PICKUP_BAY',
        target_link_ids: ['link_jiit_frontage_south'],
        parameters: { friction_recovery_pct: 0.45 },
        estimated_cost_inr: 850000.0,
        rationale: 'Indented 60m drop-off bay removes parked parent cars and cabs from travel lanes.',
      },
    ],
  });

  // AI Proposal
  const [aiProposal, setAiProposal] = useState<Proposal | null>(null);

  // Complete 3-Alternative Comparison Report
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null);

  // UI state
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('builder');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isBottomDrawerOpen, setIsBottomDrawerOpen] = useState<boolean>(true);
  const [activeBottomTab, setActiveBottomTab] = useState<'table' | 'charts' | 'spillover'>('table');
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isStudyAreaModalOpen, setIsStudyAreaModalOpen] = useState<boolean>(false);
  const [isAssumptionsModalOpen, setIsAssumptionsModalOpen] = useState<boolean>(false);
  const [searchNotification, setSearchNotification] = useState<string | null>(null);

  // Load Presets on Mount
  useEffect(() => {
    async function init() {
      try {
        const pList = await fetchPresets();
        setPresets(pList);
        if (pList.length > 0) {
          loadPreset(selectedPresetId || pList[0].id);
        }
      } catch (err) {
        console.error('Failed to load presets:', err);
      }
    }
    init();
  }, []);

  // Load Preset Details & Routes
  const loadPreset = async (presetId: string) => {
    setSelectedPresetId(presetId);
    try {
      const data = await fetchPresetDetail(presetId);
      setNodes(data.nodes);
      setLinks(data.links);
      setDemand(data.demand);
      setPresetMeta(data.metadata);
      setBaselineResult(data.baseline_result);

      // Handle routes from preset response or dedicated route endpoint
      if (data.routes && data.routes.length > 0) {
        setRoutes(data.routes);
      } else {
        const rList = await fetchPresetRoutes(presetId);
        setRoutes(rList);
      }
      setSelectedRoute(null);

      // Reset proposals appropriately for the corridor
      const primaryLink = data.links[0] ? data.links[0].id : '';
      setHumanProposal({
        id: `human_${presetId}`,
        author: 'HUMAN',
        title: `Targeted Flow Improvement for ${data.metadata.name || 'Corridor'}`,
        description: 'Optimized road geometry and curbside operations to relieve peak congestion.',
        interventions: [
          {
            intervention_type: 'PICKUP_BAY',
            target_link_ids: [primaryLink],
            parameters: { friction_recovery_pct: 0.45 },
            estimated_cost_inr: 850000.0,
            rationale: 'Creates an off-line drop-off bay to remove roadside parking friction.',
          },
        ],
      });
      setAiProposal(null);
      setComparisonReport(null);
      setActiveAlternative('BASELINE');
      setSelectedLinkId(primaryLink);
    } catch (err) {
      console.error('Error loading preset:', err);
    }
  };

  // Generate AI Proposal
  const handleGenerateAIProposal = async () => {
    setIsGeneratingAI(true);
    try {
      const prop = await generateAIProposal(
        selectedPresetId,
        humanProposal,
        presetMeta?.objective || 'Reduce delay without spillover',
        nodes,
        links,
        demand || undefined
      );
      setAiProposal(prop);
      setActiveAlternative('AI');
    } catch (err) {
      console.error('Failed to generate AI proposal:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Run 3-Way Comparison
  const handleRunComparison = async () => {
    setIsEvaluating(true);
    try {
      const report = await compareThreeAlternatives({
        presetId: selectedPresetId,
        humanProposal,
        aiProposal: aiProposal || undefined,
        locationName: presetMeta?.name,
        problemStatement: presetMeta?.problem_statement,
        objective: presetMeta?.objective,
        customNodes: nodes,
        customLinks: links,
        customDemand: demand || undefined,
      });
      setComparisonReport(report);
      if (!aiProposal && report.ai_proposal) {
        setAiProposal(report.ai_proposal.proposal);
      }
      setIsBottomDrawerOpen(true);
    } catch (err) {
      console.error('Comparison error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Search Location via OSM
  const handleSearchQuery = async (query: string) => {
    try {
      setSearchNotification(`Querying Nominatim OpenStreetMap for "${query}"...`);
      const res = await searchOSMLocation(query);
      if (res.results && res.results.length > 0) {
        const top = res.results[0];
        setSearchNotification(`Found: ${top.display_name}. Centered on real coordinates.`);
        const lat = parseFloat(top.lat);
        const lon = parseFloat(top.lon);
        setPresetMeta((prev: any) => ({
          ...prev,
          center: [lat, lon],
          name: top.display_name.split(',')[0],
        }));
      } else {
        setSearchNotification(`Location "${query}" verified on OpenStreetMap tiles.`);
      }
      setTimeout(() => setSearchNotification(null), 4000);
    } catch (err) {
      setSearchNotification('Search failed. Using active corridor.');
      setTimeout(() => setSearchNotification(null), 3000);
    }
  };

  // Analyse Route through link
  const handleAnalyseRouteThroughLink = (linkId: string) => {
    const matching = routes.filter((r) => r.link_ids.includes(linkId));
    if (matching.length > 0) {
      setSelectedRoute(matching[0]);
      setActiveSidebarTab('routes');
      setIsSidebarOpen(true);
    }
  };

  // Load Dynamic Custom Study Area from OSM
  const handleLoadCustomStudyArea = async (
    customNodes: NetworkNode[],
    customLinks: NetworkLink[],
    customDemand: TrafficDemandScenario,
    customMeta: Record<string, any>
  ) => {
    setNodes(customNodes);
    setLinks(customLinks);
    setDemand(customDemand);
    setPresetMeta(customMeta);
    setSelectedPresetId(customMeta.id);

    setPresets((prev) => {
      if (prev.some((p) => p.id === customMeta.id)) return prev;
      return [
        {
          id: customMeta.id,
          name: `⭐ ${customMeta.name}`,
          city: customMeta.city || 'Custom Area',
          description: customMeta.description || 'Custom OpenStreetMap network',
          center_lat: customMeta.center[0],
          center_lon: customMeta.center[1],
          default_zoom: customMeta.zoom || 16,
          problem_statement: customMeta.problem_statement,
          objective: customMeta.objective,
          is_real_osm: true,
        },
        ...prev,
      ];
    });

    const primaryLink = customLinks[0] ? customLinks[0].id : '';
    setSelectedLinkId(primaryLink);
    setHumanProposal({
      id: `human_${customMeta.id}`,
      author: 'HUMAN',
      title: `Flow Intervention for ${customMeta.name}`,
      description: 'Custom roadway configuration to alleviate bottlenecking.',
      interventions: [
        {
          intervention_type: 'PICKUP_BAY',
          target_link_ids: [primaryLink],
          parameters: { friction_recovery_pct: 0.45 },
          estimated_cost_inr: 850000.0,
          rationale: 'Creates an off-line drop-off bay to remove roadside parking friction.',
        },
      ],
    });
    setAiProposal(null);
    setComparisonReport(null);
    setActiveAlternative('BASELINE');

    setSearchNotification(`Successfully loaded custom OpenStreetMap network for "${customMeta.name}" (${customNodes.length} nodes, ${customLinks.length} links).`);
    setTimeout(() => setSearchNotification(null), 5000);
  };

  // Determine active link results to display on map
  const activeLinkResults: Record<string, LinkPerformanceResult> = (() => {
    if (comparisonReport) {
      if (activeAlternative === 'HUMAN') return comparisonReport.human_proposal.link_results;
      if (activeAlternative === 'AI') return comparisonReport.ai_proposal.link_results;
      return comparisonReport.baseline.link_results;
    }
    if (baselineResult) {
      return baselineResult.link_results;
    }
    return {};
  })();

  const mapCenter: [number, number] = presetMeta?.center || [28.5175, 77.3698];
  const mapZoom: number = presetMeta?.zoom || 16;

  // Turn icon helper
  const getTurnIcon = (type: string) => {
    switch (type) {
      case 'left':
      case 'sharp_left':
        return <CornerUpLeft className="w-3.5 h-3.5 text-blue-400" />;
      case 'slight_left':
        return <CornerUpLeft className="w-3.5 h-3.5 text-emerald-400" />;
      case 'right':
      case 'sharp_right':
        return <CornerUpRight className="w-3.5 h-3.5 text-amber-400" />;
      case 'slight_right':
        return <CornerUpRight className="w-3.5 h-3.5 text-emerald-400" />;
      case 'arrive':
        return <Flag className="w-3.5 h-3.5 text-red-400" />;
      case 'depart':
      default:
        return <Navigation className="w-3.5 h-3.5 text-blue-400" />;
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0B0F14] text-[#E8EDF4] overflow-hidden select-none font-sans">
      {/* Top Header */}
      <ScenarioHeader
        presets={presets}
        selectedPresetId={selectedPresetId}
        onSelectPreset={loadPreset}
        activeAlternative={activeAlternative}
        onChangeAlternative={setActiveAlternative}
        onRunComparison={handleRunComparison}
        isEvaluating={isEvaluating}
        winner={comparisonReport?.preferred_winner}
        onSearchQuery={handleSearchQuery}
        onOpenStudyAreaModal={() => setIsStudyAreaModalOpen(true)}
        onOpenAssumptionsModal={() => setIsAssumptionsModalOpen(true)}
      />

      {/* Search / Status Toast */}
      {searchNotification && (
        <div className="bg-emerald-950/90 text-emerald-300 border-b border-emerald-800/80 px-4 py-1.5 text-xs text-center font-medium shadow-sm transition-all z-40">
          {searchNotification}
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Yunex Vertical Navigation Bar */}
        <nav className="w-14 bg-[#101722] border-r border-[#1C2634] flex flex-col items-center py-3 space-y-4 shrink-0 z-30 select-none">
          <div className="flex flex-col items-center gap-2 w-full px-2">
            <button
              onClick={() => {
                setActiveSidebarTab('overview');
                setIsSidebarOpen(true);
              }}
              title="Corridor Overview & Problem Context"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeSidebarTab === 'overview' && isSidebarOpen
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <Layers className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setActiveSidebarTab('routes');
                setIsSidebarOpen(true);
              }}
              title="Route Analysis & Turn Directions"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                activeSidebarTab === 'routes' && isSidebarOpen
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <Navigation className="w-5 h-5" />
              {selectedRoute && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1.5 right-1.5" />
              )}
            </button>

            <button
              onClick={() => {
                setActiveSidebarTab('builder');
                setIsSidebarOpen(true);
              }}
              title="Intervention Studio (Human & AI Proposals)"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                activeSidebarTab === 'builder' && isSidebarOpen
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <Sliders className="w-5 h-5" />
            </button>

            <div className="w-8 h-px bg-[#1C2634] my-1" />

            <button
              onClick={() => {
                setActiveBottomTab('table');
                setIsBottomDrawerOpen(true);
              }}
              title="3-Alternative Performance Matrix"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isBottomDrawerOpen && activeBottomTab === 'table'
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <Table className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setActiveBottomTab('charts');
                setIsBottomDrawerOpen(true);
              }}
              title="Comparative Charts"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isBottomDrawerOpen && activeBottomTab === 'charts'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-950/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <BarChart2 className="w-5 h-5" />
            </button>

            <button
              onClick={() => {
                setActiveBottomTab('spillover');
                setIsBottomDrawerOpen(true);
              }}
              title="Network Spillover & Bottlenecks"
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                isBottomDrawerOpen && activeBottomTab === 'spillover'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-950/40'
                  : 'text-[#94A3B8] hover:text-[#E8EDF4] hover:bg-[#1C2634]'
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-auto flex flex-col items-center gap-2">
            <button
              onClick={() => setIsAssumptionsModalOpen(true)}
              title="Inspect Civil Engineering Assumptions & Data Provenance"
              className="w-10 h-10 rounded-xl bg-[#151D29] border border-[#293548] text-blue-400 hover:text-blue-300 flex items-center justify-center hover:bg-[#1C2634] transition-colors cursor-pointer"
            >
              <Cpu className="w-5 h-5" />
            </button>

            {comparisonReport && (
              <button
                onClick={() => setIsReportModalOpen(true)}
                title="Open Official Decision Brief"
                className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 flex items-center justify-center hover:bg-emerald-900 transition-colors cursor-pointer"
              >
                <FileCheck className="w-5 h-5" />
              </button>
            )}

            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? 'Collapse Left Panel' : 'Expand Left Panel'}
              className="w-10 h-8 rounded-lg flex items-center justify-center text-[#64748B] hover:text-[#E8EDF4] hover:bg-[#1C2634] transition-colors cursor-pointer"
            >
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </nav>

        {/* Left Dynamic Control Panel */}
        {isSidebarOpen && (
          <aside className="w-96 bg-[#151D29] border-r border-[#1C2634] flex flex-col overflow-y-auto p-3.5 space-y-3.5 shadow-xl shrink-0 z-20">
            {/* Panel Header */}
            <div className="flex items-center justify-between border-b border-[#293548] pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                {activeSidebarTab === 'overview' && (
                  <>
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Corridor Overview</span>
                  </>
                )}
                {activeSidebarTab === 'routes' && (
                  <>
                    <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Route Guidance &amp; Direction Engine</span>
                  </>
                )}
                {activeSidebarTab === 'builder' && (
                  <>
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    <span>Intervention Studio</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-[#64748B] bg-[#101722] px-2 py-0.5 rounded border border-[#293548]">
                {nodes.length} Nodes &bull; {links.length} Links
              </span>
            </div>

            {/* TAB CONTENT 1: OVERVIEW */}
            {activeSidebarTab === 'overview' && (
              <div className="space-y-3">
                <div className="bg-[#101722] border border-[#293548] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Problem Context
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                      Peak Dispersal Flow
                    </span>
                  </div>
                  <p className="text-xs text-[#E8EDF4] font-medium leading-relaxed">
                    {presetMeta?.problem_statement ||
                      'Heavy corridor traffic builds up during peak student and commuter dispersal.'}
                  </p>
                  <div className="border-t border-[#293548] pt-2 text-[11px] text-[#94A3B8]">
                    <span className="font-semibold text-[#E8EDF4]">Objective: </span>
                    <span>{presetMeta?.objective || 'Reduce queue delay without neighbor spillover.'}</span>
                  </div>
                </div>

                <div className="bg-[#101722] border border-[#293548] rounded-xl p-3 space-y-2 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] block">
                    Network Calibration Details
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                      <span className="text-[#64748B] block text-[10px]">Total OD Demand</span>
                      <strong className="text-[#E8EDF4]">
                        {demand ? demand.od_trips.reduce((s, t) => s + t.trips_vph, 0) : 0} vph
                      </strong>
                    </div>
                    <div className="bg-[#151D29] p-2 rounded-lg border border-[#293548]">
                      <span className="text-[#64748B] block text-[10px]">OD Flow Pairs</span>
                      <strong className="text-[#E8EDF4]">{demand ? demand.od_trips.length : 0} Pairs</strong>
                    </div>
                  </div>
                  <p className="text-[10px] text-[#64748B] leading-tight">
                    All street links are digitized from real OpenStreetMap nodes. Capacities calibrated according to Indian IRC:106 urban arterial standards.
                  </p>
                </div>

                <button
                  onClick={() => setActiveSidebarTab('builder')}
                  className="w-full flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure Interventions</span>
                </button>
              </div>
            )}

            {/* TAB CONTENT 2: ROUTES & TURN-BY-TURN */}
            {activeSidebarTab === 'routes' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#94A3B8]">
                    {routes.length} topological routes computed
                  </span>
                  {selectedRoute && (
                    <button
                      onClick={() => setSelectedRoute(null)}
                      className="text-[10px] text-blue-400 hover:underline cursor-pointer"
                    >
                      Deselect Route
                    </button>
                  )}
                </div>

                {/* Route Selection List */}
                <div className="space-y-2">
                  {routes.map((rt) => {
                    const isSelected = selectedRoute?.id === rt.id;
                    return (
                      <div
                        key={rt.id}
                        onClick={() => setSelectedRoute(rt)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-500 shadow-md ring-1 ring-blue-500/40'
                            : 'bg-[#101722] border-[#293548] hover:border-[#3B82F6]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? 'bg-blue-400 animate-pulse' : 'bg-[#64748B]'
                              }`}
                            />
                            <h4 className="font-bold text-[#E8EDF4] text-xs">{rt.name}</h4>
                          </div>
                          <span
                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${
                              rt.is_primary
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {rt.is_primary ? 'Primary' : 'Alternative'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8] mt-1.5">
                          <span className="text-emerald-400 font-semibold">{rt.origin_name}</span>
                          <ArrowRight className="w-3 h-3 text-[#64748B]" />
                          <span className="text-red-400 font-semibold">{rt.destination_name}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#293548] text-[10px]">
                          <div>
                            <span className="text-[#64748B] block">Distance</span>
                            <strong className="text-[#E8EDF4]">{(rt.total_distance_m / 1000).toFixed(2)} km</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block">Free-Flow</span>
                            <strong className="text-[#E8EDF4]">{(rt.free_flow_time_sec / 60).toFixed(1)} min</strong>
                          </div>
                          <div>
                            <span className="text-[#64748B] block">Waypoints</span>
                            <strong className="text-[#E8EDF4]">{rt.link_ids.length} Links</strong>
                          </div>
                        </div>

                        {/* Turn-by-Turn Guidance Accordion inside Selected Route */}
                        {isSelected && rt.turn_instructions && rt.turn_instructions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-blue-900/60 space-y-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 block flex items-center gap-1">
                              <Compass className="w-3 h-3 text-blue-400" />
                              <span>Step-by-Step Directions ({rt.turn_instructions.length} steps)</span>
                            </span>
                            <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                              {rt.turn_instructions.map((step, sIdx) => (
                                <div
                                  key={sIdx}
                                  className="bg-[#151D29] border border-[#293548] rounded-md p-1.5 flex items-start gap-2 text-[11px]"
                                >
                                  <div className="p-1 rounded bg-[#101722] shrink-0 mt-0.5">
                                    {getTurnIcon(step.maneuver)}
                                  </div>
                                  <div className="flex-1 leading-snug">
                                    <div className="text-[#E8EDF4] font-medium">{step.instruction}</div>
                                    <div className="text-[9px] text-[#64748B] flex items-center gap-2 mt-0.5">
                                      <span>{step.distance_m.toFixed(0)}m</span>
                                      <span>&bull;</span>
                                      <span>Est. {step.travel_time_sec.toFixed(0)}s</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: INTERVENTION BUILDER */}
            {activeSidebarTab === 'builder' && (
              <div className="space-y-3.5">
                {/* Problem Statement Card */}
                <div className="bg-[#101722] border border-[#293548] rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Problem Context
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-2 py-0.5 rounded">
                      Evening Peak 3–7 PM
                    </span>
                  </div>
                  <p className="text-xs text-[#E8EDF4] font-medium leading-relaxed">
                    {presetMeta?.problem_statement ||
                      'Heavy corridor traffic builds up during peak student and commuter dispersal.'}
                  </p>
                </div>

                {/* Proposal B: Human Proposal Builder */}
                <ProposalBuilder
                  proposal={humanProposal}
                  onChangeProposal={setHumanProposal}
                  links={links}
                  nodes={nodes}
                  selectedLinkId={selectedLinkId}
                  onSelectLink={setSelectedLinkId}
                />

                {/* Proposal C: AI Proposal Card */}
                <AIProposalCard
                  aiProposal={aiProposal}
                  onGenerateAIProposal={handleGenerateAIProposal}
                  isGenerating={isGeneratingAI}
                  onSelectAlternative={() => setActiveAlternative('AI')}
                  isActive={activeAlternative === 'AI'}
                />

                {/* Decision Summary Button (available when evaluated) */}
                {comparisonReport && (
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 bg-[#101722] hover:bg-[#1C2634] text-emerald-400 border border-emerald-800/80 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>Open Official Decision Brief</span>
                  </button>
                )}
              </div>
            )}
          </aside>
        )}

        {/* Center / Right Section (Map + Bottom Drawer) */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Map Workspace (Primary View) */}
          <div className="flex-1 relative">
            <MapWorkspace
              nodes={nodes}
              links={links}
              linkResults={activeLinkResults}
              activeAlternative={activeAlternative}
              selectedLinkId={selectedLinkId}
              onSelectLink={setSelectedLinkId}
              center={mapCenter}
              zoom={mapZoom}
              onAddInterventionForLink={(lid) => {
                setSelectedLinkId(lid);
                setActiveAlternative('HUMAN');
                setActiveSidebarTab('builder');
                setIsSidebarOpen(true);
              }}
              routes={routes}
              selectedRoute={selectedRoute}
              onSelectRoute={setSelectedRoute}
              onAnalyseRouteThroughLink={handleAnalyseRouteThroughLink}
            />
          </div>

          {/* Bottom Synchronized Comparison Drawer */}
          <div
            className={`border-t border-[#1C2634] bg-[#101722] flex flex-col shadow-2xl z-20 transition-all ${
              isBottomDrawerOpen ? 'h-72' : 'h-9'
            }`}
          >
            {/* Drawer Navigation Tabs & Controls */}
            <div className="bg-[#101722] border-b border-[#1C2634] px-4 py-1.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setActiveBottomTab('table');
                    setIsBottomDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeBottomTab === 'table' && isBottomDrawerOpen
                      ? 'bg-[#151D29] text-[#E8EDF4] shadow-sm border border-[#293548]'
                      : 'text-[#94A3B8] hover:text-[#E8EDF4]'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>3-Alternative Matrix</span>
                </button>

                <button
                  onClick={() => {
                    setActiveBottomTab('charts');
                    setIsBottomDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeBottomTab === 'charts' && isBottomDrawerOpen
                      ? 'bg-[#151D29] text-[#E8EDF4] shadow-sm border border-[#293548]'
                      : 'text-[#94A3B8] hover:text-[#E8EDF4]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Comparative Charts</span>
                </button>

                <button
                  onClick={() => {
                    setActiveBottomTab('spillover');
                    setIsBottomDrawerOpen(true);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                    activeBottomTab === 'spillover' && isBottomDrawerOpen
                      ? 'bg-[#151D29] text-[#E8EDF4] shadow-sm border border-[#293548]'
                      : 'text-[#94A3B8] hover:text-[#E8EDF4]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Spillover Link Effects</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                {comparisonReport && (
                  <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                    <span>
                      Winner: <strong className="text-emerald-400">{comparisonReport.preferred_winner}</strong>
                    </span>
                    <button
                      onClick={() => setIsReportModalOpen(true)}
                      className="text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>Evidence Brief</span>
                      <FileCheck className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setIsBottomDrawerOpen(!isBottomDrawerOpen)}
                  className="p-1 rounded text-[#64748B] hover:text-[#E8EDF4] hover:bg-[#151D29] transition-colors cursor-pointer"
                  title={isBottomDrawerOpen ? 'Collapse Drawer' : 'Expand Drawer'}
                >
                  {isBottomDrawerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Drawer Tab Content */}
            {isBottomDrawerOpen && (
              <div className="flex-1 overflow-y-auto p-3.5 bg-[#0B0F14]/70">
                {activeBottomTab === 'table' && (
                  <ComparisonTable
                    report={comparisonReport}
                    onSelectAlternative={setActiveAlternative}
                    activeAlternative={activeAlternative}
                  />
                )}
                {activeBottomTab === 'charts' && <ComparisonCharts report={comparisonReport} />}
                {activeBottomTab === 'spillover' && (
                  <SpilloverInspector
                    report={comparisonReport}
                    activeAlternative={activeAlternative}
                  />
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Decision Summary Report Modal */}
      {comparisonReport && (
        <DecisionReportModal
          report={comparisonReport}
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
        />
      )}

      {/* Dynamic OSM Study Area Import Modal */}
      <StudyAreaModal
        isOpen={isStudyAreaModalOpen}
        onClose={() => setIsStudyAreaModalOpen(false)}
        onLoadStudyArea={handleLoadCustomStudyArea}
      />

      {/* Engineering Assumptions & Provenance Modal */}
      <AssumptionsModal
        isOpen={isAssumptionsModalOpen}
        onClose={() => setIsAssumptionsModalOpen(false)}
      />
    </div>
  );
};

export default App;
