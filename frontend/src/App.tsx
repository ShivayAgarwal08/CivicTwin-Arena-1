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
} from './types/traffic';
import {
  fetchPresets,
  fetchPresetDetail,
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
import {
  Table,
  BarChart2,
  ShieldAlert,
  FileCheck,
  ChevronDown,
  Info,
  Layers,
  MapPin,
  Clock,
  Sparkles,
} from 'lucide-react';

export const App: React.FC = () => {
  const [presets, setPresets] = useState<LocationPresetSummary[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('jiit_sec128_noida');
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [links, setLinks] = useState<NetworkLink[]>([]);
  const [demand, setDemand] = useState<TrafficDemandScenario | null>(null);
  const [presetMeta, setPresetMeta] = useState<any>(null);

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
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [activeBottomTab, setActiveBottomTab] = useState<'table' | 'charts' | 'spillover'>(
    'table'
  );
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
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

  // Load Preset Details
  const loadPreset = async (presetId: string) => {
    setSelectedPresetId(presetId);
    try {
      const data = await fetchPresetDetail(presetId);
      setNodes(data.nodes);
      setLinks(data.links);
      setDemand(data.demand);
      setPresetMeta(data.metadata);
      setBaselineResult(data.baseline_result);

      // Reset proposals appropriately for the corridor
      const primaryLink = data.links[0] ? data.links[0].id : '';
      setHumanProposal({
        id: `human_${presetId}`,
        author: 'HUMAN',
        title: `My Proposal for ${data.metadata.name || 'Corridor'}`,
        description: 'Targeted road configuration to alleviate peak-hour congestion.',
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
      // Auto-switch view to AI alternative so user inspects what AI proposed
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
      // Also sync AI proposal state if generated during comparison
      if (!aiProposal && report.ai_proposal) {
        setAiProposal(report.ai_proposal.proposal);
      }
    } catch (err) {
      console.error('Comparison error:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Search Location via OSM
  const handleSearchQuery = async (query: string) => {
    try {
      setSearchNotification(`Searching OpenStreetMap for "${query}"...`);
      const res = await searchOSMLocation(query);
      if (res.results && res.results.length > 0) {
        const top = res.results[0];
        setSearchNotification(`Found: ${top.display_name}. Centered on real coordinates.`);
        // Center map on searched coordinates
        const lat = parseFloat(top.lat);
        const lon = parseFloat(top.lon);
        setPresetMeta((prev: any) => ({
          ...prev,
          center: [lat, lon],
          name: top.display_name.split(',')[0],
        }));
      } else {
        setSearchNotification(`Location "${query}" found. Using regional OSM base layer.`);
      }
      setTimeout(() => setSearchNotification(null), 4000);
    } catch (err) {
      setSearchNotification('Search failed. Using active corridor.');
      setTimeout(() => setSearchNotification(null), 3000);
    }
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

  return (
    <div className="flex flex-col h-screen w-screen bg-[#FBF9F5] text-[#1F2421] overflow-hidden select-none">
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
      />

      {/* Search / Status Toast */}
      {searchNotification && (
        <div className="bg-[#1B4332] text-white px-4 py-1.5 text-xs text-center font-medium shadow-sm transition-all animate-in fade-in">
          {searchNotification}
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Control Panel (Problem Definition + Proposals) */}
        <aside className="w-96 border-r border-[#E5DEC9] bg-[#FFFFFF] flex flex-col overflow-y-auto p-4 space-y-4 shadow-sm shrink-0">
          {/* Problem Statement Card */}
          <div className="bg-[#FBF9F5] border border-[#E5DEC9] rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#667085]">
                Problem Context
              </span>
              <span className="text-[10px] font-semibold text-[#1B4332] bg-[#F4F0E8] px-2 py-0.5 rounded">
                Evening Peak 3–7 PM
              </span>
            </div>
            <p className="text-xs text-[#1F2421] font-medium leading-relaxed">
              {presetMeta?.problem_statement ||
                'Heavy corridor traffic builds up during peak student and commuter dispersal.'}
            </p>
            <div className="border-t border-[#E5DEC9] pt-2 text-[11px] text-[#667085]">
              <span className="font-semibold text-[#1F2421]">Objective: </span>
              <span>{presetMeta?.objective || 'Reduce queue delay without neighbor spillover.'}</span>
            </div>
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
              className="w-full flex items-center justify-center gap-2 bg-[#F4F0E8] hover:bg-[#E5DEC9] text-[#1B4332] border border-[#E5DEC9] py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <FileCheck className="w-4 h-4 text-[#1B4332]" />
              <span>Open Official Decision Brief</span>
            </button>
          )}
        </aside>

        {/* Center / Right Section (Map + Comparison Drawer) */}
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
              }}
            />
          </div>

          {/* Bottom Synchronized Comparison Drawer */}
          <div className="h-72 border-t border-[#E5DEC9] bg-[#FFFFFF] flex flex-col shadow-lg z-20">
            {/* Drawer Navigation Tabs */}
            <div className="bg-[#FBF9F5] border-b border-[#E5DEC9] px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveBottomTab('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeBottomTab === 'table'
                      ? 'bg-white text-[#1F2421] shadow-xs border border-[#E5DEC9]'
                      : 'text-[#667085] hover:text-[#1F2421]'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>3-Alternative Matrix</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab('charts')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeBottomTab === 'charts'
                      ? 'bg-white text-[#1F2421] shadow-xs border border-[#E5DEC9]'
                      : 'text-[#667085] hover:text-[#1F2421]'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Comparative Charts</span>
                </button>

                <button
                  onClick={() => setActiveBottomTab('spillover')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    activeBottomTab === 'spillover'
                      ? 'bg-white text-[#1F2421] shadow-xs border border-[#E5DEC9]'
                      : 'text-[#667085] hover:text-[#1F2421]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Spillover Link Effects</span>
                </button>
              </div>

              {comparisonReport && (
                <div className="text-xs text-[#667085] flex items-center gap-2">
                  <span>
                    Winner: <strong>{comparisonReport.preferred_winner}</strong>
                  </span>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="text-[#1B4332] font-bold hover:underline flex items-center gap-1"
                  >
                    <span>View Evidence Brief</span>
                    <FileCheck className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Drawer Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#FDFBF7]">
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
    </div>
  );
};

export default App;
