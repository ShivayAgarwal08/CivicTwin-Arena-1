import React, { useState } from 'react';
import type { LocationPresetSummary, AuthorType, WinnerType } from '../types/traffic';
import { Layers, Search, Play, Trophy, Building2, MapPin, Compass } from 'lucide-react';

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
}) => {
  const [searchInput, setSearchInput] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearchQuery(searchInput.trim());
    }
  };

  return (
    <header className="bg-[#FFFFFF] border-b border-[#E5DEC9] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
      {/* Brand & Purpose */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#1B4332] text-white flex items-center justify-center font-bold shadow-sm">
          <Compass className="w-6 h-6 text-[#A3E635]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#1F2421]">CivicTwin Arena</h1>
            <span className="text-[11px] font-semibold uppercase tracking-wider bg-[#F4F0E8] text-[#1B4332] border border-[#E5DEC9] px-2 py-0.5 rounded">
              3-Alternative Studio
            </span>
          </div>
          <p className="text-xs text-[#667085]">
            Map-First Urban Traffic Planning & Fair Intervention Comparison
          </p>
        </div>
      </div>

      {/* Corridor Presets & Search */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-[#FBF9F5] border border-[#E5DEC9] rounded-lg px-3 py-1.5 text-xs text-[#1F2421]">
          <Building2 className="w-4 h-4 text-[#1B4332]" />
          <span className="font-semibold text-[#667085]">Corridor:</span>
          <select
            value={selectedPresetId}
            onChange={(e) => onSelectPreset(e.target.value)}
            className="bg-transparent font-medium text-[#1F2421] focus:outline-none cursor-pointer"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleSearchSubmit} className="relative">
          <input
            type="text"
            placeholder="Search city, campus, metro..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8 pr-3 py-1.5 bg-[#FBF9F5] border border-[#E5DEC9] rounded-lg text-xs w-48 focus:w-64 transition-all focus:outline-none focus:border-[#1B4332] text-[#1F2421]"
          />
          <Search className="w-3.5 h-3.5 text-[#667085] absolute left-2.5 top-2.5 pointer-events-none" />
        </form>
      </div>

      {/* Alternative View Selector Tabs */}
      <div className="flex items-center bg-[#F4F0E8] p-1 rounded-lg border border-[#E5DEC9] text-xs font-medium">
        <button
          onClick={() => onChangeAlternative('BASELINE')}
          className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
            activeAlternative === 'BASELINE'
              ? 'bg-white text-[#1F2421] font-semibold shadow-sm'
              : 'text-[#667085] hover:text-[#1F2421]'
          }`}
        >
          <span>A. Baseline Network</span>
          {winner === 'BASELINE' && <Trophy className="w-3.5 h-3.5 text-amber-600" />}
        </button>

        <button
          onClick={() => onChangeAlternative('HUMAN')}
          className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
            activeAlternative === 'HUMAN'
              ? 'bg-[#1B4332] text-white font-semibold shadow-sm'
              : 'text-[#667085] hover:text-[#1F2421]'
          }`}
        >
          <span>B. My Proposal</span>
          {winner === 'HUMAN' && <Trophy className="w-3.5 h-3.5 text-[#A3E635]" />}
        </button>

        <button
          onClick={() => onChangeAlternative('AI')}
          className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
            activeAlternative === 'AI'
              ? 'bg-[#2563EB] text-white font-semibold shadow-sm'
              : 'text-[#667085] hover:text-[#1F2421]'
          }`}
        >
          <span>C. AI Alternative</span>
          {winner === 'AI' && <Trophy className="w-3.5 h-3.5 text-amber-300" />}
        </button>
      </div>

      {/* Run Evaluation Button */}
      <button
        onClick={onRunComparison}
        disabled={isEvaluating}
        className="flex items-center gap-2 bg-[#1B4332] hover:bg-[#143225] disabled:opacity-60 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all"
      >
        <Play className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin' : 'fill-white'}`} />
        <span>{isEvaluating ? 'Simulating Traffic...' : 'Evaluate 3 Alternatives'}</span>
      </button>
    </header>
  );
};
