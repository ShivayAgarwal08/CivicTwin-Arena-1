import React, { useState } from 'react';
import type { LocationPresetSummary, AuthorType, WinnerType } from '../types/traffic';
import {
  Layers,
  Search,
  Play,
  Trophy,
  Building2,
  MapPin,
  Compass,
  Cpu,
  Activity,
  CheckCircle2,
  Sliders,
  Sparkles,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';

interface ScenarioHeaderProps {
  presets: LocationPresetSummary[];
  selectedPresetId: string;
  onSelectPreset: (id: string) => void;
  activeAlternative: AuthorType;
  onChangeAlternative: (alt: AuthorType) => void;
  onRunComparison: () => void;
  isEvaluating: boolean;
  winner?: WinnerType;
  onSearchQuery: (q: string) => void;
  onOpenStudyAreaModal?: () => void;
  onOpenAssumptionsModal?: () => void;
}

export const ScenarioHeader: React.FC<ScenarioHeaderProps> = ({
  presets,
  selectedPresetId,
  onSelectPreset,
  activeAlternative,
  onChangeAlternative,
  onRunComparison,
  isEvaluating,
  winner,
  onSearchQuery,
  onOpenStudyAreaModal,
  onOpenAssumptionsModal,
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchQuery(searchInput.trim());
    }
  };

  return (
    <header className="bg-[#101722] border-b border-[#1C2634] px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 shadow-md z-30 select-none">
      {/* Brand & Subtitle */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center font-bold shadow-lg shadow-emerald-950/40 border border-emerald-400/30">
          <Compass className="w-5 h-5 text-emerald-100" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[#E8EDF4]">CivicTwin Arena</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-950/70 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded">
              ITS Twin Engine
            </span>
            {winner && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-950/70 text-blue-400 border border-blue-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                <Trophy className="w-3 h-3 text-amber-400" />
                Winner: {winner}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#94A3B8]">
            Yunex-Inspired Urban Traffic Planning &amp; Multi-Alternative Simulation
          </p>
        </div>
      </div>

      {/* Center Provenance Badges (Clickable to open Assumptions & Specs) */}
      <div className="hidden xl:flex items-center gap-2">
        <button
          onClick={onOpenAssumptionsModal}
          title="Click to inspect OpenStreetMap geometry provenance"
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#151D29] hover:bg-[#1C2634] border border-[#293548] text-[10px] text-[#94A3B8] transition-colors cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[#64748B]">Topology:</span>
          <strong className="text-[#E8EDF4]">OSM WGS84 Geometry</strong>
        </button>
        <button
          onClick={onOpenAssumptionsModal}
          title="Click to view BPR and Webster signal formulas"
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#151D29] hover:bg-[#1C2634] border border-[#293548] text-[10px] text-[#94A3B8] transition-colors cursor-pointer"
        >
          <Cpu className="w-3 h-3 text-blue-400" />
          <span className="text-[#64748B]">Physics:</span>
          <strong className="text-[#E8EDF4]">BPR + Webster Flow</strong>
        </button>
        <button
          onClick={onOpenAssumptionsModal}
          title="Click to view regulatory standard: IRC:106-1990"
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#151D29] hover:bg-[#1C2634] border border-[#293548] text-[10px] text-[#94A3B8] transition-colors cursor-pointer"
        >
          <Activity className="w-3 h-3 text-amber-400" />
          <span className="text-[#64748B]">Standard:</span>
          <strong className="text-[#E8EDF4]">IRC:106 Peak Flow</strong>
        </button>
      </div>

      {/* Corridor Presets, Import & Search */}
      <div className="flex items-center gap-2">
        {/* Preset Selector */}
        <div className="flex items-center gap-1 bg-[#151D29] border border-[#293548] rounded-lg px-2.5 py-1 text-xs text-[#E8EDF4]">
          <Building2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="text-[11px] text-[#94A3B8]">Corridor:</span>
          <select
            value={selectedPresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="bg-transparent font-medium text-xs text-[#E8EDF4] focus:outline-none cursor-pointer pr-1 max-w-[140px] sm:max-w-[210px] truncate"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#151D29] text-[#E8EDF4]">
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Real OSM Area Import Button */}
        {onOpenStudyAreaModal && (
          <button
            onClick={onOpenStudyAreaModal}
            title="Import real road network from OpenStreetMap for any city or corridor"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#151D29] hover:bg-emerald-950/70 text-emerald-400 hover:text-emerald-300 border border-[#293548] hover:border-emerald-700/60 text-xs font-semibold transition-all cursor-pointer shadow-xs"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import Real OSM</span>
          </button>
        )}

        {/* Quick Search */}
        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search city / sector..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-7 pr-3 py-1 bg-[#151D29] border border-[#293548] rounded-lg text-xs w-32 sm:w-40 transition-all focus:outline-none focus:border-blue-500 text-[#E8EDF4] placeholder-[#64748B]"
          />
          <Search className="w-3.5 h-3.5 text-[#64748B] absolute left-2 top-2 pointer-events-none" />
        </form>
      </div>

      {/* Scenario Alternative Toggle Pills & Run Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-[#151D29] p-0.5 rounded-lg border border-[#293548] text-xs">
          <button
            onClick={() => onChangeAlternative('BASELINE')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              activeAlternative === 'BASELINE'
                ? 'bg-[#1C2634] text-[#E8EDF4] shadow-sm font-semibold border border-[#3B82F6]/50'
                : 'text-[#94A3B8] hover:text-[#E8EDF4]'
            }`}
          >
            A. Baseline
          </button>
          <button
            onClick={() => onChangeAlternative('HUMAN')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
              activeAlternative === 'HUMAN'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-[#94A3B8] hover:text-[#E8EDF4]'
            }`}
          >
            <Sliders className="w-3 h-3" />
            B. Human
          </button>
          <button
            onClick={() => onChangeAlternative('AI')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 ${
              activeAlternative === 'AI'
                ? 'bg-purple-600 text-white shadow-sm font-semibold'
                : 'text-[#94A3B8] hover:text-[#E8EDF4]'
            }`}
          >
            <Sparkles className="w-3 h-3 text-purple-200" />
            C. AI
          </button>
        </div>

        {/* Primary Simulation Button */}
        <button
          onClick={onRunComparison}
          disabled={isEvaluating}
          className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md shadow-emerald-950/40 cursor-pointer"
        >
          <Play className={`w-3.5 h-3.5 fill-current ${isEvaluating ? 'animate-spin' : ''}`} />
          <span>{isEvaluating ? 'Simulating Physics...' : 'Simulate 3 Alternatives'}</span>
        </button>
      </div>
    </header>
  );
};
